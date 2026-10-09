import { jest } from '@jest/globals';

// Round-6 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-06 (round 6)").

const { contextFor, evaluateTag } = await import('./predicate.mjs');
const { isExpired, isValidUntil, stampFor } = await import('./expiry.mjs');
const { resolveValue } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors, recipients } = await import('./steps.mjs');
const { ruleMovementStages } = await import('./adapter.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 2, powers: { personal: { value: 1, max: 3 } } },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        const deletion = (__isForcedDeletion(value) ? key.match(/^(.*)\.([^.]+)$/) : key.match(/^(.*)\.-=(.+)$/));
        if (deletion) {
          delete deletion[1].split('.').reduce((at, k) => at?.[k], this)?.[deletion[2]];
        } else {
          setPath(this, key, value);
        }
      }
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = {
    contents: items, get: id => actor.items.contents.find(i => i.id == id), find: fn => actor.items.contents.find(fn),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  for (const item of items) {
    item.parent = actor;
  }

  return actor;
}

beforeEach(() => {
  global.game = {
    combat: null, combats: { get: () => null }, time: { worldTime: 1000 }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => (key == 'E20.Test.Row' ? 'A localized row' : key), format: key => key, has: key => key == 'E20.Test.Row' },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

describe('tags', () => {
  test('status:<id>:timed, compound wielding (&), upgrade traits, hasUpgrade, rule:hostEquipped, combat statuses, roll:fumble', () => {
    const timed = { statuses: new Set(['stunned']), duration: { rounds: 2 } };
    const open = { statuses: new Set(['frightened']), duration: {} };
    const foe = makeActor('Foe', [], { type: 'npc', effects: { contents: [timed, open] }, statuses: new Set(['stunned', 'frightened']) });
    const hero = makeActor('Hero');
    const ctx = contextFor({ self: hero, other: foe });
    expect(evaluateTag('target:status:stunned:timed', ctx)).toBe(true);
    expect(evaluateTag('target:status:frightened:timed', ctx)).toBe(false);

    const gun = { id: 'w1', type: 'weapon', system: { equipped: true, traits: [], itemAndUpgradeTraits: ['ballistic'] }, flags: {} };
    const shot = { id: 'e1', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'w1' } } };
    const scope = { id: 'u1', name: 'Tritium Sights', type: 'upgrade', system: {}, flags: { essence20: { parentId: 'w1' } }, _stats: { compendiumSource: 'Compendium.x.Item.trit' } };
    const shooter = makeActor('Shooter', [gun, shot, scope]);
    const sctx = contextFor({ self: shooter, item: shot, ruleItem: scope });
    expect(evaluateTag('self:wielding:weapon:trait:ballistic&not:attack:melee', sctx)).toBe(true);
    expect(evaluateTag('self:wielding:weapon:trait:ballistic&attack:melee', sctx)).toBe(false);
    expect(evaluateTag('item:trait:ballistic', sctx)).toBe(true);
    expect(evaluateTag('item:hasUpgrade:Compendium.x.Item.trit', sctx)).toBe(true);
    expect(evaluateTag('item:hasUpgrade:name~tritium', sctx)).toBe(true);
    expect(evaluateTag('rule:hostEquipped', sctx)).toBe(true);
    gun.system.equipped = false;
    expect(evaluateTag('rule:hostEquipped', sctx)).toBe(false);

    const combat = { started: true, combatants: { contents: [{ actor: hero }, { actor: foe }] } };
    expect(evaluateTag('combat:enemyStatus:stunned', contextFor({ self: hero, combat }))).toBe(true);
    expect(evaluateTag('combat:allyStatus:stunned', contextFor({ self: hero, combat }))).toBe(false);
    expect(evaluateTag('roll:fumble', contextFor({ isFumble: true }))).toBe(true);
    expect(evaluateTag('roll:fumble', contextFor({}))).toBeNull();
  });
});

describe('durations', () => {
  test('worldTime:<seconds> and nextTurnOrScene', () => {
    expect(isValidUntil('worldTime:604800')).toBe(true);
    const week = { until: 'worldTime:604800', stamp: stampFor('worldTime:604800') };
    expect(week.stamp).toEqual({ worldTime: 605800 });
    expect(isExpired(week)).toBe(false);
    game.time.worldTime = 605800;
    expect(isExpired(week)).toBe(true);
    expect(stampFor('nextTurnOrScene', null)).toEqual({ epoch: 1 });
    const a = { id: 'a' };
    const combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: a }, { actor: { id: 'b' } }] };
    const entry = { until: 'nextTurnOrScene', stamp: stampFor('nextTurnOrScene', combat, a) };
    expect(isExpired(entry, { ...combat, turn: 1 })).toBe(false);
    expect(isExpired(entry, { ...combat, round: 2, turn: 0 })).toBe(true);
  });
});

describe('steps and recipients', () => {
  test('updateActor reads @recipient for each recipient\'s own limit', async () => {
    const a = makeActor('A', [], { system: { powers: { personal: { value: 1, max: 3 } } } });
    const b = makeActor('B', [], { system: { powers: { personal: { value: 0, max: 5 } } } });
    const ctx = stepContext({ actor: a, item: { name: 'Morphin Navigator' }, targets: [a, b] });
    await runSteps([{ do: 'updateActor', to: 'targets', add: { 'system.powers.personal.value': 4 }, max: '@recipient.system.powers.personal.max' }], ctx);
    expect([a.system.powers.personal.value, b.system.powers.personal.value]).toEqual([3, 4]);
    expect(resolveValue('@recipient.system.level', { recipient: { system: { level: 7 } } })).toBe(7);
  });

  test('an exclusive mark moves: the setter\'s mark comes off whoever had it', async () => {
    const hero = makeActor('Hero');
    const one = makeActor('One');
    const two = makeActor('Two');
    game.actors = { contents: [hero, one, two] };
    await runSteps([{ do: 'mark', to: 'target', key: 'lastHit', exclusive: true }], stepContext({ actor: hero, item: { name: 'S.W.A.T.' }, targets: [one] }));
    await runSteps([{ do: 'mark', to: 'target', key: 'lastHit', exclusive: true }], stepContext({ actor: hero, item: { name: 'S.W.A.T.' }, targets: [two] }));
    expect(one.flags.essence20.ruleMarks.lastHit).toBeUndefined();
    expect(two.flags.essence20.ruleMarks.lastHit.by).toBe(hero.uuid);
    expect(stepErrors([{ do: 'mark', exclusive: true }])).toHaveLength(1);
  });

  test('combatAllies and alliesOfTarget / enemiesOfTarget', () => {
    const hero = makeActor('Hero');
    const pal = makeActor('Pal');
    const goon = makeActor('Goon', [], { type: 'npc' });
    const boss = makeActor('Boss', [], { type: 'npc' });
    game.combat = { combatants: { contents: [{ actor: hero }, { actor: pal }, { actor: goon }] } };
    const ctx = stepContext({ actor: hero, item: { name: 'Martyr' }, targets: [goon] });
    expect(recipients({ to: 'combatAllies' }, ctx)).toEqual([pal]);
    expect(recipients({ to: 'combatAllies+self' }, ctx)).toEqual([hero, pal]);
    const at = (actor, x, disposition) => {
      const token = { actor, document: { disposition }, center: { x, y: 0 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    global.canvas = { tokens: { placeables: [at(hero, 0, 1), at(goon, 50, -1), at(boss, 55, -1), at(pal, 200, 1)] }, grid: { measurePath: ([p, q]) => ({ distance: Math.abs(p.x - q.x) }) } };
    expect(recipients({ to: 'alliesOfTarget:10' }, ctx)).toEqual([boss]);
    expect(recipients({ to: 'enemiesOfTarget:60' }, ctx)).toEqual([hero]);
    expect(stepErrors([{ do: 'heal', to: 'alliesOfTarget:10' }])).toEqual([]);
    delete global.canvas;
  });

  test('table row text may be an i18n key', async () => {
    const ctx = stepContext({ actor: makeActor('Pinkie'), item: { name: 'Pinkie Sense' }, targets: [] });
    ctx.random = () => 0;
    await runSteps([{ do: 'table', formula: '1d4', rows: [{ min: 1, max: 4, text: 'E20.Test.Row' }] }], ctx);
    expect(ctx.chat.at(-1)).toBe('A localized row');
  });
});

describe('rules', () => {
  test('Movement afterDerived stage and rounding', () => {
    const rules = [
      { type: 'Movement', movement: 'ground', stage: 'afterDerived', op: 'multiply', value: 1.5, round: 'floor' },
    ];
    const item = { id: 'p', name: 'Ship Shape', type: 'perk', flags: {}, system: { rules } };
    const hero = makeActor('Hero', [item]);
    rebuildIndex(hero);
    const stage = ruleMovementStages(hero);
    expect(stage('afterDerived', 'ground', 25)).toBe(37);
    expect(stage('final', 'ground', 25)).toBeNull();
    expect(validateRule({ ...rules[0], round: 'sideways' })).toHaveLength(1);
  });

  test('team scope is a link scope; notDouble outcome validates', () => {
    expect(validateRule({ type: 'RollModifier', scope: 'team', upshift: 1 })).toEqual([]);
    expect(validateRule({ type: 'Trigger', event: 'afterRoll', outcome: ['fumble', 'anySucceeded', 'notDouble'], steps: [{ do: 'chat', text: 'x' }] })).toEqual([]);
  });
});

describe('open rolls and target:self', () => {
  test('fireOpenRoll runs afterRoll Triggers with outcome any (not success / failure ones), @var.total', async () => {
    const { fireOpenRoll } = await import('./triggers.mjs');
    const rules = [
      { type: 'Trigger', event: 'afterRoll', outcome: 'any', when: ['skill:athletics'], steps: [{ do: 'chat', text: 'jumped {var.total}' }] },
      { type: 'Trigger', event: 'afterRoll', outcome: 'failure', steps: [{ do: 'chat', text: 'failed' }] },
    ];
    const hero = makeActor('Hero', [{ id: 'p', name: 'Gravity Optional', type: 'perk', flags: {}, system: { rules } }]);
    rebuildIndex(hero);
    const seen = [];
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    await fireOpenRoll(hero, 17, 'athletics');
    expect(seen.join(' ')).toContain('jumped 17');
    expect(seen.join(' ')).not.toContain('failed');
  });

  test('target:self', () => {
    const hero = makeActor('Hero');
    expect(evaluateTag('target:self', contextFor({ self: hero, other: hero }))).toBe(true);
    expect(evaluateTag('target:self', contextFor({ self: hero, other: makeActor('Other') }))).toBe(false);
  });
});

test('an open roll skips afterRoll Triggers with no outcome set', async () => {
  const { fireOpenRoll } = await import('./triggers.mjs');
  const hero = makeActor('Hero', [{ id: 'p', name: 'Fool Me Twice', type: 'perk', flags: {}, system: { rules: [{ type: 'Trigger', event: 'afterRoll', steps: [{ do: 'chat', text: 'fired' }] }] } }]);
  rebuildIndex(hero);
  ChatMessage.create = jest.fn();
  await fireOpenRoll(hero, 12, 'deception');
  expect(ChatMessage.create).not.toHaveBeenCalled();
});
