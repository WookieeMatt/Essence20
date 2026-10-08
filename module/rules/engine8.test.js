import { jest } from '@jest/globals';

// Round-8 engine pieces (docs/RULES_CONVERSION_GUIDE.md, "Engine features added 2026-10-06 (round 8)").

const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), callAll: () => {} };

const { contextFor, evaluateTag } = await import('./predicate.mjs');
const { isExpired, stampFor } = await import('./expiry.mjs');
const { resolveValue, formulaError } = await import('./formula.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { ruleWeaponTraits } = await import('./adapter.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
}

let nextId = 1;
function makeActor(name, items = [], extra = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', documentName: 'Actor', isOwner: true, flags: { essence20: {} }, statuses: new Set(),
    system: { level: 2, skills: { athletics: { shift: 'd4' } }, powers: { personal: { value: 4, max: 4 } } },
    ...extra,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        const deletion = key.match(/^(.*)\.-=(.+)$/);
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
    combat: null, combats: { get: () => null }, user: { id: 'u', isGM: true, targets: new Set() }, actors: { contents: [] },
    users: { contents: [] }, settings: { get: () => 1 }, i18n: { localize: key => key, format: key => key },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) } };
});

describe('marks per setter', () => {
  test('two setters keep their own mark and count; markedByMe, marked and @target.myMark read the right one', async () => {
    const one = makeActor('One');
    const two = makeActor('Two');
    const foe = makeActor('Foe');
    const mark = actor => runSteps([{ do: 'mark', to: 'target', key: 'q', perSetter: true, count: 1, add: true }], stepContext({ actor, item: { name: 'Loaded Questions' }, targets: [foe] }));
    await mark(one);
    await mark(one);
    await mark(two);
    expect(resolveValue('@target.myMark.q', { actor: one, other: foe })).toBe(2);
    expect(resolveValue('@target.myMark.q', { actor: two, other: foe })).toBe(1);
    expect(evaluateTag('markedByMe:q', contextFor({ self: one, other: foe }))).toBe(true);
    expect(evaluateTag('target:marked:q', contextFor({ self: makeActor('Other'), other: foe }))).toBe(true);
    await runSteps([{ do: 'unmark', to: 'target', key: 'q', perSetter: true }], stepContext({ actor: one, item: {}, targets: [foe] }));
    expect(evaluateTag('markedByMe:q', contextFor({ self: one, other: foe }))).toBe(false);
    expect(evaluateTag('markedByMe:q', contextFor({ self: two, other: foe }))).toBe(true);
  });
});

describe('formulas, durations, tags', () => {
  test('@sum, @count.named, atLeast()', () => {
    const vest = { id: 'v', name: 'Light Vest', type: 'armor', system: { equipped: true, totalBonusToughness: 2 } };
    const coat = { id: 'c', name: 'Heavy Coat', type: 'armor', system: { equipped: false, totalBonusToughness: 3 } };
    const dart = { id: 'd', name: 'Stim Dart', type: 'gear', system: {} };
    const dart2 = { id: 'd2', name: 'Extra Stim Dart', type: 'gear', system: {} };
    const hero = makeActor('Hero', [vest, coat, dart, dart2]);
    expect(resolveValue('@sum.equipped.armor.system.totalBonusToughness', { actor: hero })).toBe(2);
    expect(resolveValue('@sum.items.armor.system.totalBonusToughness', { actor: hero })).toBe(5);
    expect(resolveValue('@count.named.stim_dart', { actor: hero })).toBe(2);
    let n = 0;
    const faces = [0.99, 0.1, 0.8, 0.99];
    expect(resolveValue('atLeast(4, 4, 4)', { random: () => faces[n++] })).toBe(3);
    expect(resolveValue('atLeast(0, 4, 4)', {})).toBe(0);
    expect(formulaError('atLeast(@var.spent, 4, 4)')).toBeNull();
  });

  test('until mission; self:combatant; scene:token', () => {
    const entry = { until: 'mission', stamp: stampFor('mission') };
    expect(isExpired(entry)).toBe(false);
    game.settings.get = () => 2;
    expect(isExpired(entry)).toBe(true);
    game.settings.get = () => 1;
    const hero = makeActor('Hero');
    const goon = makeActor('Goon', [], { type: 'npc' });
    expect(evaluateTag('self:combatant', contextFor({ self: hero }))).toBe(false);
    game.combat = { combatants: { contents: [{ actor: hero }] } };
    expect(evaluateTag('self:combatant', contextFor({ self: hero }))).toBe(true);
    expect(evaluateTag('scene:token:target:type:npc', contextFor({ self: hero }))).toBeNull();
    global.canvas = { tokens: { placeables: [{ actor: hero }, { actor: goon }] } };
    expect(evaluateTag('scene:token:target:type:npc', contextFor({ self: hero }))).toBe(true);
    expect(evaluateTag('scene:token:target:name~boss', contextFor({ self: hero }))).toBe(false);
    delete global.canvas;
  });
});

describe('steps', () => {
  test('pick from actors of a type; setVar; updateActor ladder', async () => {
    const hero = makeActor('Hero');
    const zord = makeActor('Rex', [], { type: 'zord' });
    game.actors = { contents: [hero, zord, makeActor('Goon', [], { type: 'npc' })] };
    const item = { name: 'Zord Mount', flags: {}, async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    } };
    const ctx = stepContext({ actor: hero, item, targets: [] });
    let offered = null;
    ctx.askPick = async (step, options) => {
      offered = options.map(o => o.label);
      return options[0].value;
    };

    await runSteps([{ do: 'pick', key: 'mount', from: 'actors', actorType: 'zord' }], ctx);
    expect(offered).toEqual(['Rex']);
    await runSteps([{ do: 'setVar', key: 'half', value: '@level * 3' }, { do: 'setVar', key: 'word', value: 'hello {var.half}' }], ctx);
    expect(ctx.vars).toMatchObject({ half: 6, word: 'hello 6' });
    await runSteps([{ do: 'updateActor', ladder: { 'system.skills.athletics.shift': 2 } }], ctx);
    expect(hero.system.skills.athletics.shift).toBe('d8');
    await runSteps([{ do: 'updateActor', ladder: { 'system.skills.athletics.shift': -9 } }], ctx);
    expect(hero.system.skills.athletics.shift).toBe('d20');
    expect(stepErrors([{ do: 'setVar' }])).toHaveLength(1);
  });

  test('a Trigger that lowers @var.spent passes the lower number to the next Trigger on the event', async () => {
    const refund = { type: 'Trigger', event: 'resourceSpent', steps: [{ do: 'setVar', key: 'spent', value: '@var.spent - 2' }] };
    const after = { type: 'Trigger', event: 'resourceSpent', steps: [{ do: 'chat', text: 'saw {var.spent}' }] };
    const hero = makeActor('Hero', [
      { id: 'p1', name: 'Inner Conservation', type: 'perk', flags: {}, system: { rules: [refund] } },
      { id: 'p2', name: 'Dino Charged', type: 'perk', flags: {}, system: { rules: [after] } },
    ]);
    rebuildIndex(hero);
    const seen = [];
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    await fireTriggers(hero, 'resourceSpent', { vars: { spent: 4, resource: 'power' } });
    expect(seen.join(' ')).toContain('saw 2');
  });
});

describe('events and weapon traits', () => {
  test('itemAdded fires for another item; movedOnTurn for the combatant moving on its turn', async () => {
    const watch = [{ type: 'Trigger', event: 'itemAdded', when: ['item:type:upgrade'], steps: [{ do: 'chat', text: 'added {var.x}' }] },
      { type: 'Trigger', event: 'movedOnTurn', steps: [{ do: 'chat', text: 'moved' }] }];
    const perk = { id: 'p', name: 'Lingering', type: 'perk', flags: {}, system: { rules: watch } };
    const hero = makeActor('Hero', [perk]);
    rebuildIndex(hero);
    const seen = [];
    ChatMessage.create = jest.fn(async data => seen.push(data.content));
    const upgrade = { id: 'u', name: 'Scope', type: 'upgrade', parent: hero, system: {}, flags: {} };
    hooks.createItem.forEach(fn => fn(upgrade, {}, 'u'));
    hooks.createItem.forEach(fn => fn({ id: 'g', type: 'gear', parent: hero, system: {}, flags: {} }, {}, 'u'));
    game.combat = { started: true, combatant: { tokenId: 't1', actor: hero } };
    hooks.updateToken.forEach(fn => fn({ id: 't1', actor: hero }, { x: 10 }, {}, 'u'));
    hooks.updateToken.forEach(fn => fn({ id: 't2', actor: makeActor('Other') }, { x: 10 }, {}, 'u'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(seen.filter(text => text.includes('added')).length).toBe(1);
    expect(seen.filter(text => text.includes('moved')).length).toBe(1);
  });

  test('ruleWeaponTraits gives the rules the weapon\'s id (item:picked: on a WeaponTrait)', () => {
    const gun = { id: 'g1', name: 'Gun', type: 'weapon', system: { traits: [] }, flags: {} };
    const perk = { id: 'p', name: 'Same Principle', type: 'perk', flags: { essence20: { rules: { choices: { gun: 'g1' } } } },
      system: { rules: [{ type: 'WeaponTrait', traits: ['ballistic'], items: ['item:picked:gun'] }] } };
    const hero = makeActor('Hero', [gun, perk]);
    rebuildIndex(hero);
    expect(ruleWeaponTraits(hero, gun, [])).toEqual(['ballistic']);
  });
});
