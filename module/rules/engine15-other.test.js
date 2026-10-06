import { jest } from '@jest/globals';

/**
 * Round 15, part Other (docs/rules-batches/slOther15.md): the engine pieces this part built, on their own (the pack
 * items using them are in conv15-other.test.js).
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { ACTION_KEYS } = await import('./types.mjs');
const { registerActionKind } = await import('./actions.mjs');
const { ruleFreeActionEssence } = await import('./plugins/resources/action-count.mjs');
const { ruleSkipsReload } = await import('./plugins/combat/reload-skip.mjs');
const { anyCircumstanceGrant, sneakAttackWeaponGrants } = await import('./plugins/combat/sneak-attack-grant.mjs');
const { affordableSneakAttackGrant, paySneakAttackGrant } = await import('../mechanics/combat/sneak-attack.mjs');

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeItem(rules, extra = {}) {
  return {
    id: `i${nextId++}`, name: extra.name ?? 'Thing', type: extra.type ?? 'perk', effects: [],
    flags: extra.flags ?? {}, system: { rules, ...(extra.system ?? {}) },
  };
}

function makeActor(items = [], system = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', flags: {}, system, statuses: new Set(),
    getFlag(scope, key) {
      return getPath(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
  };
  actor.items = { contents: list, get: id => list.find(item => item.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  global.game = { ...(global.game ?? {}), combat: null, actors: [], user: { id: 'u', isGM: false, targets: new Set() } };
  global.ui = { ...(global.ui ?? {}), notifications: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } };
});

/* ---- ActionCost kinds ---- */

describe('registerActionKind', () => {
  test('reload and morph are ActionCost actions; a new kind can be added', () => {
    expect(ACTION_KEYS).toEqual(expect.arrayContaining(['reload', 'morph']));
    expect(validateRule({ type: 'ActionCost', action: 'reload', to: 'free' })).toEqual([]);
    expect(validateRule({ type: 'ActionCost', action: 'teleport', to: 'free' })).not.toEqual([]);
    registerActionKind('teleport');
    expect(validateRule({ type: 'ActionCost', action: 'teleport', to: 'free' })).toEqual([]);
    const actor = makeActor([makeItem([{ type: 'ActionCost', action: 'teleport', to: 'move' }])]);
    const [rule] = costRulesFor(actor);
    expect(rule.matches({ kind: 'teleport' })).toBe(true);
    expect(rule.matches({ key: 'teleport' })).toBe(false);
  });
});

/* ---- ActionCount ---- */

describe('ActionCount', () => {
  test('an essence swap wins; adds sum; a false `when` is ignored', () => {
    const essences = { speed: { max: 3 }, smarts: { max: 5 }, social: { value: 4 } };
    const add = (n, when) => makeItem([{ type: 'ActionCount', action: 'free', add: n, ...(when ? { when } : {}) }]);
    expect(ruleFreeActionEssence(makeActor([add(1), add(2)], { essences }), 3)).toBe(6);
    expect(ruleFreeActionEssence(makeActor([add(2, ['self:transformed'])], { essences, isTransformed: false }), 3)).toBe(3);
    const swap = makeItem([{ type: 'ActionCount', action: 'free', essence: 'social' }]);
    expect(ruleFreeActionEssence(makeActor([add(2), swap], { essences }), 3)).toBe(4);
    expect(ruleFreeActionEssence(makeActor([], { essences }), 3)).toBe(3);
  });

  test('validation', () => {
    expect(validateRule({ type: 'ActionCount', action: 'free' })).toEqual(['needs essence or add']);
    expect(validateRule({ type: 'ActionCount', action: 'free', essence: 'luck' })).not.toEqual([]);
  });
});

/* ---- ReloadSkip ---- */

describe('ReloadSkip', () => {
  const weapon = { id: 'w1', name: 'Rifle', flags: {} };

  test('skips while its limit lasts, says so, and honours combatOnly / when / priority', async () => {
    const late = makeItem([{ type: 'ReloadSkip', limit: { per: 'scene' }, message: 'Late {weapon}', priority: 1 }]);
    const early = makeItem([{ type: 'ReloadSkip', combatOnly: true, limit: { per: 'encounter' }, message: 'Early {name}' }]);
    const actor = makeActor([late, early]);
    game.i18n = { ...(game.i18n ?? {}), format: (key, data) => key.replace(/\{(\w+)\}/g, (m, k) => data[k]) };
    expect(await ruleSkipsReload(actor, weapon)).toBe(true);
    expect(ui.notifications.info).toHaveBeenLastCalledWith('Late Rifle');
    expect(await ruleSkipsReload(actor, weapon)).toBe(false);
    game.combat = { id: 'c' };
    const both = makeActor([makeItem([{ type: 'ReloadSkip', limit: { per: 'scene' }, priority: 1 }]),
      makeItem([{ type: 'ReloadSkip', combatOnly: true, limit: { per: 'encounter' }, message: 'Early {name}' }])]);
    expect(await ruleSkipsReload(both, weapon)).toBe(true);
    expect(ui.notifications.info).toHaveBeenLastCalledWith('Early Hero');
    const gated = makeActor([makeItem([{ type: 'ReloadSkip', when: ['item:name~pistol'] }])]);
    expect(await ruleSkipsReload(gated, weapon)).toBe(false);
    expect(await ruleSkipsReload(gated, { ...weapon, name: 'Heavy Pistol' })).toBe(true);
  });

  test('validation', () => {
    expect(validateRule({ type: 'ReloadSkip', limit: { per: 'scene' } })).toEqual([]);
    expect(validateRule({ type: 'ReloadSkip', limit: { per: 'week' } })).not.toEqual([]);
  });
});

/* ---- SneakAttackGrant ---- */

describe('SneakAttackGrant', () => {
  const effect = { id: 'e1', type: 'weaponEffect', name: 'Shot', flags: {}, system: { classification: { style: 'explosive' } } };

  test('qualifies / range: the widest range wins, `items` narrows, qualifies:false only sets range', () => {
    const grant = rule => makeItem([{ type: 'SneakAttackGrant', ...rule }]);
    expect(sneakAttackWeaponGrants(makeActor([grant({})]), effect)).toEqual({ qualifies: true, range: undefined });
    expect(sneakAttackWeaponGrants(makeActor([grant({ qualifies: false, range: 60 })]), effect)).toEqual({ qualifies: false, range: 60 });
    expect(sneakAttackWeaponGrants(makeActor([grant({ range: 60 }), grant({ range: 'weapon' })]), effect).range).toBe('weapon');
    expect(sneakAttackWeaponGrants(makeActor([grant({ range: 'weapon' }), grant({ range: 'unlimited' })]), effect).range).toBe('unlimited');
    const narrow = makeActor([grant({ items: ['item:data:system.classification.style=melee'] })]);
    expect(sneakAttackWeaponGrants(narrow, effect).qualifies).toBe(false);
  });

  test('any circumstance: offered while its limit lasts and its Story Point can be paid; paying counts the limit', async () => {
    const actor = makeActor([makeItem([{ type: 'SneakAttackGrant', anyCircumstance: true, cost: { storyPoints: 1 }, limit: { per: 'encounter' } }])]);
    expect(anyCircumstanceGrant(actor)).not.toBeNull();
    game.actors = { party: { isOwner: false, system: { storyPoints: 0 } } };
    game.users = [{ isGM: true, active: true }];
    expect(affordableSneakAttackGrant(actor)).toBeNull();
    game.actors = { party: { isOwner: false, system: { storyPoints: 1 } } };
    expect(affordableSneakAttackGrant(actor)).not.toBeNull();
    game.socket = { emit: jest.fn() };
    await paySneakAttackGrant(actor);
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({ action: 'spendStoryPoints', amount: 1 }));
    expect(anyCircumstanceGrant(actor)).toBeNull();
    delete game.users;
  });

  test('validation', () => {
    expect(validateRule({ type: 'SneakAttackGrant', range: 'far' })).not.toEqual([]);
    expect(validateRule({ type: 'SneakAttackGrant', cost: { resource: 'x' } })).not.toEqual([]);
    expect(validateRule({ type: 'SneakAttackGrant', anyCircumstance: true, cost: { storyPoints: 1 }, limit: { per: 'encounter' } })).toEqual([]);
  });
});
