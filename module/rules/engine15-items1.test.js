import { jest } from '@jest/globals';

/**
 * Round 15, part "items1" (docs/rules-batches/slItems115.md): the engine pieces, one at a time, on plain fake actors - the
 * options and edges the converted items don't reach. The items themselves are in conv15-items1.test.js.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };

const picks = [];
const CATALOG = [];
const grants = {
  findItems: jest.fn(async ({ type, matches }) => CATALOG.filter(entry => entry.type == type && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => rows.find(row => row.name == picks.shift())?.uuid ?? null),
  chooseSelect: jest.fn(async (title, prompt, options) => options.find(option => option.label == picks[0] || option.value == picks[0]) && options.find(option => option.label == picks[0] || option.value == picks.shift())?.value),
  grantCopy: jest.fn(async () => null),
  rollTest: jest.fn(async () => ({ success: true, crit: false, total: 15, multiplier: 1 })),
};
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext, registerDropGrant, stepErrors } = await import('./steps.mjs');
const { contextFor, evaluate, interpolate } = await import('./predicate.mjs');
const { fanningShotRules } = await import('./plugins/combat/fanning-shots.mjs');
const { ruleIgnoresTrait } = await import('./plugins/combat/trait-ignore.mjs');
const { ruleCoatingCost, ruleKeepsVialOnFumble } = await import('./plugins/resources/poison-coating-rule.mjs');
const { healBonuses } = await import('./plugins/resources/heal-bonus.mjs');
const { allyDefenseOutcome } = await import('./plugins/combat/ally-reactions.mjs');
const { ruleDefenseAura } = await import('./plugins/combat/defense-aura.mjs');
const { ruleAttackChoice, NO_CHOICE } = await import('./plugins/combat/attack-choice.mjs');
const { packOf } = await import('./plugins/tags/item-pack-tag.mjs');
const { itemMarkSources, inoperableWarning } = await import('./plugins/gear/item-disruption.mjs');
const { linkedWarning, syncLinked, removeLinked } = await import('./plugins/effects/linked-host.mjs');
const { shapeOptions } = await import('./plugins/effects/shape-change.mjs');
const { criticallyHit } = await import('./plugins/combat/critically-hit-event.mjs');

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((at, key) => (at[key] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete node[last.replace(/^-=/, '')];
  } else {
    node[last] = value;
  }
}

const getPath = (object, path) => String(path).split('.').reduce((at, key) => at?.[key], object);
let nextId = 1;

function makeItem(actor, data) {
  const item = {
    id: `i${nextId++}`, flags: { essence20: {} }, system: {}, parent: actor,
    ...data,
    update: jest.fn(async function (changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(item, key, value);
      }
    }),
  };
  item.uuid = `${actor?.uuid ?? 'x'}.Item.${item.id}`;
  return item;
}

function makeActor(name, { items = [], system = {}, disposition = 1, x = 0 } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type: 'playerCharacter', flags: { essence20: {} }, statuses: new Set(), isOwner: true,
    system: { level: 6, health: { value: 7, max: 10 }, skills: {}, defenses: { toughness: { total: 12 }, evasion: { total: 10 } }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(actor, key, value);
      }

      rebuildIndex(actor);
    }),
    createEmbeddedDocuments: jest.fn(async (type, datas) => {
      const made = datas.map(data => makeItem(actor, JSON.parse(JSON.stringify(data))));
      actor.items.contents.push(...made);
      rebuildIndex(actor);
      return made;
    }),
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      actor.items.contents = actor.items.contents.filter(item => !ids.includes(item.id));
      rebuildIndex(actor);
    }),
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  const list = items.map(data => makeItem(actor, data));
  actor.items = {
    contents: list,
    get: id => actor.items.contents.find(item => item.id == id),
    [Symbol.iterator]: () => actor.items.contents[Symbol.iterator](),
  };
  const token = { actor, document: { disposition }, center: { x, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  rebuildIndex(actor);
  return actor;
}

const perk = (rules, extra = {}) => ({ name: 'Perk', type: 'perk', system: { rules }, ...extra });

const savedGame = global.game;
beforeEach(() => {
  picks.length = 0;
  CATALOG.length = 0;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { contents: [] }, actors: { contents: [] },
    settings: { get: () => 1 }, i18n: { localize: key => key, format: (key, data) => (data ? `${key}:${Object.values(data).join(',')}` : key), has: () => false },
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = { ...global.foundry, utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: getPath, deepClone: value => JSON.parse(JSON.stringify(value)) } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = undefined;
});

afterEach(() => {
  global.game = savedGame;
});

const run = (steps, actor, { targets = [], item = null, vars = {} } = {}) => {
  const ctx = stepContext({ actor, item: item ?? makeItem(actor, { name: 'Test', type: 'perk' }), rule: {}, targets });
  Object.assign(ctx.vars, vars);
  return runSteps(steps, ctx).then(result => ({ result, ctx }));
};

describe('validation of the new rule types and steps', () => {
  test.each([
    [{ type: 'FanningShots' }, 'needs extraShots or firstShotUpshift'],
    [{ type: 'SuccessToCrit' }, 'needs when'],
    [{ type: 'PoisonCoating' }, 'needs cost or keepVialOnFumble'],
    [{ type: 'HealBonus' }, 'needs amount or steps'],
    [{ type: 'DefenseAura', defenses: ['toughness'], bonus: 'rolePoints' }, 'needs a radius'],
    [{ type: 'DefenseAura', radius: 10, bonus: 'rolePoints' }, 'needs defenses'],
    [{ type: 'DefenseAura', radius: 10, defenses: ['toughness'] }, 'needs bonus: rolePoints or an amount'],
    [{ type: 'AttackChoice' }, 'needs options'],
    [{ type: 'AttackChoice', options: [{ label: 'x' }] }, 'changes nothing'],
    [{ type: 'AttackChoice', options: [{ damage: 2 }] }, 'needs a label'],
    [{ type: 'ShapeOption', kind: 'other' }, 'kind must be skill or size'],
    [{ type: 'ShapeOption', kind: 'skill' }, 'a skill option needs a key'],
  ])('%j', (rule, problem) => {
    expect(validateRule(rule).join(' | ')).toContain(problem);
  });

  test('good ones pass', () => {
    for (const rule of [
      { type: 'DefenseAura', radius: 10, defenses: ['evasion'], amount: '2' },
      { type: 'AttackChoice', options: [{ label: 'Up', shiftUp: 1 }] },
      { type: 'ShapeOption', kind: 'size' },
      { type: 'Trigger', event: 'criticallyHit', steps: [] },
    ]) {
      expect([rule.type, validateRule(rule)]).toEqual([rule.type, []]);
    }
  });

  test('step errors', () => {
    expect(stepErrors([{ do: 'linkToHost', name: 3 }]).join()).toContain('linkToHost name must be text');
    expect(stepErrors([{ do: 'changeShape', prompt: 3 }]).join()).toContain('changeShape prompt must be text');
    expect(stepErrors([{ do: 'targetCircle' }]).join()).toContain('targetCircle needs a radius');
    expect(stepErrors([{ do: 'setDataset', key: 'x' }]).join()).toContain('setDataset needs a key and data');
    expect(stepErrors([{ do: 'mutateWeapon', set: {} }]).join()).toContain('mutateWeapon needs onto');
    expect(stepErrors([{ do: 'grantAttacks' }]).join()).toContain('grantAttacks needs a uuid');
  });
});

describe('core step options', () => {
  test('recipients first: only the first N after the filter', async () => {
    const actor = makeActor('A');
    const [b, c, d] = ['B', 'C', 'D'].map(name => makeActor(name));
    const { ctx } = await run([{ do: 'setVar', key: 'n', value: 1 }, { do: 'countRecipients', to: 'targets', first: '1 + @var.n', var: 'count' }], actor, { targets: [b, c, d] });
    expect(ctx.vars.count).toBe(2);
  });

  test('roll dataset: a lone {var.x} keeps its value (a number stays a number), text fills', async () => {
    const actor = makeActor('A', { system: { skills: { technology: {} } } });
    await run([{ do: 'roll', skill: 'technology', dif: 10, dataset: { amount: '{var.n}', label: 'x{var.n}', fixed: true } }], actor, { vars: { n: 3 } });
    expect(grants.rollTest.mock.calls.at(-1)[3]).toMatchObject({ amount: 3, label: 'x3', fixed: true });
  });

  test('{sourced.<id>.<path>} reads the actor\'s copy of that book item', () => {
    const actor = makeActor('A', { items: [{ name: 'Affinity', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.x.Item.DgFY0ZmAtClAobiA' } }, system: { choice: 'fire' } }] });
    const item = actor.items.contents[0];
    expect(interpolate('system.resistances.{sourced.DgFY0ZmAtClAobiA.system.choice}', item)).toBe('system.resistances.fire');
    expect(interpolate('{sourced.AAAAAAAAAAAAAAAA.system.choice}', item)).toBeNull();
  });
});

describe('pickGrant viaDrop / byOriginalId', () => {
  test('a registered type is given through its drop function; nothing made stops the run; byOriginalId leaves out what an originalId names', async () => {
    const made = [];
    registerDropGrant('testThing', async (actor, uuid, { grantedBy, flags }) => {
      if (uuid.endsWith('refused')) {
        return null;
      }

      made.push({ uuid, grantedBy: grantedBy?.id, flags });
      return { name: 'Made' };
    });
    CATALOG.push({ uuid: 'Compendium.essence20.x.Item.one', name: 'One', type: 'testThing' }, { uuid: 'Compendium.essence20.x.Item.two', name: 'Two', type: 'testThing' },
      { uuid: 'Compendium.essence20.x.Item.refused', name: 'Refused', type: 'testThing' });
    const actor = makeActor('A', { items: [{ name: 'Held', type: 'testThing', system: { originalId: 'one' } }] });
    const item = makeItem(actor, { name: 'Giver', type: 'perk' });
    picks.push('Two');
    const step = { do: 'pickGrant', from: { type: 'testThing', notOwned: true, byOriginalId: true }, viaDrop: true, flags: { tag: 'yes' } };
    const first = await run([step, { do: 'setVar', key: 'after', value: 1 }], actor, { item });
    expect(grants.findItems.mock.calls.at(-1)[0].matches(CATALOG[0])).toBe(false);
    expect(grants.findItems.mock.calls.at(-1)[0].matches(CATALOG[1])).toBe(true);
    expect(made).toEqual([{ uuid: 'Compendium.essence20.x.Item.two', grantedBy: item.id, flags: { tag: 'yes' } }]);
    expect(first.ctx.vars.after).toBe(1);
    picks.push('Refused');
    const second = await run([step, { do: 'setVar', key: 'after', value: 1 }], actor, { item });
    expect(second.result).toBe(false);
    expect(second.ctx.vars.after).toBeUndefined();
  });
});

describe('item selector var: and tag itemVar', () => {
  test('the item a var names, on the recipient; an item tag asked of it', async () => {
    const actor = makeActor('A', { items: [{ name: 'Radio', type: 'gear', system: { equipped: true } }] });
    const [radio] = actor.items.contents;
    global.fromUuidSync = uuid => (uuid == radio.uuid ? radio : null);
    await run([{ do: 'updateItem', item: 'var:it', set: { 'system.equipped': false } }], actor, { vars: { it: radio.uuid } });
    expect(radio.system.equipped).toBe(false);
    const ask = (tag, vars) => evaluate([tag], contextFor({ self: actor, vars }));
    expect(ask('itemVar:it:item:type:gear', { it: radio.uuid })).toBe(true);
    expect(ask('itemVar:it:item:type:weapon', { it: radio.uuid })).toBe(false);
    expect(ask('itemVar:none:item:type:gear', {})).toBe(false);
  });
});

describe('item mark effects', () => {
  test('rollSnag / rollShiftDown on rolls with the item (an attack counts its weapon) or naming it; inoperable warns', () => {
    const actor = makeActor('A', { items: [{ name: 'Gun', type: 'weapon', flags: { essence20: { ruleItemMarks: { jam: { effects: { rollShiftDown: 1, inoperable: true } } } } } }] });
    const [gun] = actor.items.contents;
    const shot = makeItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: gun.id } } });
    global.fromUuidSync = uuid => (uuid == gun.uuid ? gun : null);
    expect(itemMarkSources(actor, null, { item: shot }).sources).toEqual([{ id: expect.any(String), label: 'Gun', shiftDown: 1 }]);
    expect(itemMarkSources(actor, null, { item: gun, dataset: { markedItemUuid: gun.uuid } }).sources).toHaveLength(1);
    expect(itemMarkSources(actor, null, {}).sources).toEqual([]);
    expect(inoperableWarning(actor, shot)).toBe('E20.Gij3StillInoperable:Gun');
    expect(inoperableWarning(actor, gun)).toBeNull();
  });
});

describe('linkToHost', () => {
  test('needs a host and a granted item; text names fill {weapon} / {item}; no warn text, no warning', async () => {
    const actor = makeActor('A', { items: [{ name: 'Blade', type: 'weapon', system: { equipped: false } }] });
    const [blade] = actor.items.contents;
    const loose = makeItem(actor, { name: 'Up', type: 'upgrade' });
    expect((await run([{ do: 'linkToHost' }], actor, { item: loose })).result).toBe(false);

    const upgrade = makeItem(actor, { name: 'Up', type: 'upgrade', flags: { essence20: { parentId: blade.id } } });
    actor.items.contents.push(makeItem(actor, { name: 'Buckler', type: 'shield', flags: { essence20: { grantedBy: upgrade.id } }, system: { active: true } }));
    await run([{ do: 'linkToHost', name: '{weapon} + {item}' }], actor, { item: upgrade });
    const shield = actor.items.contents.at(-1);
    expect([shield.name, shield.flags.essence20.linkedHost, shield.system.equipped, shield.system.active]).toEqual(['Blade + Buckler', blade.id, false, false]);
    shield.system.active = true;
    expect(linkedWarning(actor, blade)).toBeNull();

    // A non-shield linked item just follows the equip state; another user's change is left to them.
    await syncLinked(blade, { system: { equipped: true } }, {}, 'u');
    expect(shield.system.equipped).toBe(true);
    await syncLinked(blade, { name: 'x' }, {}, 'u');
    await removeLinked(blade, {}, 'other');
    expect(actor.items.contents).toContain(shield);
  });
});

describe('DefenseAura amount / AttackChoice several rules / shape options / packOf / criticallyHit', () => {
  test('an amount formula aura, asked as the holder', () => {
    const holder = makeActor('Holder', { items: [perk([{ type: 'DefenseAura', defenses: ['evasion'], radius: 5, amount: '@level - 4' }])], x: 5 });
    const ally = makeActor('Ally');
    global.canvas = { tokens: { placeables: [ally.token, holder.token] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    expect(ruleDefenseAura(ally, 'evasion')).toBe(2);
    expect(ruleDefenseAura(ally, 'toughness')).toBe(0);
  });

  test('two AttackChoice rules share one list; a rule whose when fails is left out', async () => {
    const actor = makeActor('A', { items: [
      perk([{ type: 'AttackChoice', options: [{ label: 'One', damage: 1 }] }]),
      perk([{ type: 'AttackChoice', options: [{ label: 'Two', shiftUp: 3 }] }]),
      perk([{ type: 'AttackChoice', when: ['item:type:weapon'], options: [{ label: 'Never', damage: 9 }] }]),
    ] });
    const effect = makeItem(actor, { type: 'weaponEffect', system: { classification: { style: 'melee' } } });
    global.foundry.applications = { api: { DialogV2: { wait: jest.fn(async config => (config.content.includes('Never') ? null : '1')) } } };
    expect(await ruleAttackChoice(actor, effect)).toEqual({ ...NO_CHOICE, shiftUp: 3 });
  });

  test('shape options: skill keys once each, a size step per stacking size rule', () => {
    const actor = makeActor('A', { items: [
      perk([{ type: 'ShapeOption', kind: 'skill', key: 'k', label: 'K' }]),
      perk([{ type: 'ShapeOption', kind: 'skill', key: 'k', label: 'K again' }], { system: { selectionLimit: 2, rules: [{ type: 'ShapeOption', kind: 'skill', key: 'k', label: 'K again' }] } }),
      perk([{ type: 'ShapeOption', kind: 'size', stacks: true }]),
    ] });
    expect(shapeOptions(actor)).toEqual({ skills: [{ key: 'k', label: 'K' }], sizeSteps: 1 });
  });

  test('packOf / item:pack', () => {
    expect(packOf('Compendium.essence20.mlp_crb.Item.abc')).toBe('mlp_crb');
    expect(packOf('Actor.x.Item.y')).toBeNull();
    const actor = makeActor('A', { items: [{ name: 'Owned', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.in_a_jam.Item.q' } } }] });
    const ask = item => evaluate(['item:pack:mlp_crb|in_a_jam'], contextFor({ self: actor, item }));
    expect(ask(actor.items.contents[0])).toBe(true);
    expect(ask({ uuid: 'Compendium.essence20.gi_joe_crb.Item.z', name: 'Z' })).toBe(false);
  });

  test('criticallyHit: no actor, nothing; the attacker is the target', async () => {
    await expect(criticallyHit(null)).resolves.toBeUndefined();
    const actor = makeActor('A', { items: [perk([{ type: 'Trigger', event: 'criticallyHit', steps: [{ do: 'setVar', key: 'x', value: 1 }, { do: 'markItem', item: 'self', key: 'hitBy', to: 'self' }] }])] });
    await criticallyHit(actor, makeActor('Foe'));
    expect(actor.items.contents[0].flags.essence20.ruleItemMarks?.hitBy).toBeTruthy();
  });
});

describe('small rule types read back', () => {
  test('FanningShots add up; TraitIgnore by items tags; PoisonCoating cheapest; HealBonus when as the target', () => {
    const actor = makeActor('A', { items: [
      perk([{ type: 'FanningShots', extraShots: 1 }]), perk([{ type: 'FanningShots', extraShots: 2, firstShotUpshift: 1 }], { system: { selectionLimit: 1, rules: [{ type: 'FanningShots', extraShots: 2, firstShotUpshift: 1 }] } }),
      perk([{ type: 'TraitIgnore', traits: ['mounted'], items: ['item:name~Cannon'] }]),
      perk([{ type: 'PoisonCoating', cost: 'move' }]), perk([{ type: 'PoisonCoating', cost: 'free', keepVialOnFumble: true }]),
      perk([{ type: 'HealBonus', amount: 2, when: ['target:status:defeated'] }]),
    ] });
    expect(fanningShotRules(actor)).toEqual({ extraShots: 3, firstShotUpshift: 1 });
    expect(ruleIgnoresTrait(actor, { name: 'Big Cannon', type: 'weapon' }, 'mounted')).toBe(true);
    expect(ruleIgnoresTrait(actor, { name: 'Rifle', type: 'weapon' }, 'mounted')).toBe(false);
    expect(ruleCoatingCost(actor)).toBe('free');
    expect(ruleKeepsVialOnFumble(actor)).toBe(true);
    const down = makeActor('Down');
    down.statuses.add('defeated');
    expect(healBonuses(actor, down).map(bonus => bonus.amount)).toEqual([2]);
    expect(healBonuses(actor, makeActor('Up'))).toEqual([]);
  });

  test('allyDefenseOutcome: hit / turned / missed; none without a reactor', () => {
    const row = { difficulty: 14, defenderStepBonus: 2, defenderStepReactorUuid: 'Actor.r' };
    expect(allyDefenseOutcome(row, 16)).toBe('hit');
    expect(allyDefenseOutcome(row, 13)).toBe('turned');
    expect(allyDefenseOutcome(row, 10)).toBe('missed');
    expect(allyDefenseOutcome({ difficulty: 14 }, 16)).toBeNull();
  });
});
