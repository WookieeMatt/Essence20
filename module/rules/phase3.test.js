import { jest } from '@jest/globals';
import { isExpired, stampFor } from './expiry.mjs';
import { contextFor, evaluateTag, setWorldLookups, toggleOf } from './predicate.mjs';
import { LINK_HOLDERS, rebuildIndex } from './index.mjs';
import { applyRuleImmunity, consumeLimited, ruleDerived, ruleRollSources, ruleSpecializes, strongestPerGroup } from './adapter.mjs';
import { runSteps, stepContext, stepErrors } from './steps.mjs';
import { fireItemAdded, fireTriggers, sweepExpired } from './triggers.mjs';
import { summarizeRule, validateRule } from './types.mjs';
import { registrySnapshot } from '../mechanics/item-hooks.mjs';
import './links.mjs';

let nextId = 1;
const actors = new Map();

function makeActor(rules = [], extra = {}) {
  const items = (extra.items ?? []).concat(rules.length ? [makeItem(rules)] : []);
  const actor = {
    id: `a${nextId++}`, type: extra.type ?? 'playerCharacter', name: extra.name ?? 'Hero', isOwner: true, statuses: new Set(),
    flags: { essence20: {} },
    system: { level: 2, actors: extra.crew ?? {}, health: { value: 5, max: 10 }, defenses: { toughness: { total: 10, string: '10' } } },
    getActiveTokens: () => extra.token ? [extra.token] : [],
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
    deleteEmbeddedDocuments: jest.fn(async () => []),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  actors.set(actor.uuid, actor);
  rebuildIndex(actor);
  return actor;
}

function makeItem(rules, extra = {}) {
  return {
    id: `i${nextId++}`, name: extra.name ?? 'Thing', type: 'perk', flags: extra.flags ?? {}, system: { rules, ...(extra.system ?? {}) },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(this, key, value);
      }
    },
  };
}

beforeEach(() => {
  actors.clear();
  LINK_HOLDERS.clear();
  global.fromUuidSync = uuid => actors.get(uuid) ?? null;
  global.game = {
    combat: null, user: { id: 'u', targets: new Set() }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: key => key, format: key => key }, scenes: { active: { name: 'The Old Library' } },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: (object, key, value) => {
        const keys = key.split('.');
        const last = keys.pop();
        keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
      },
      randomID: () => `r${nextId++}`,
    },
  };
});

describe('durations', () => {
  test('stamps and expiry: turn, round, scene; untimed and unstamped never expire', () => {
    const combat = { started: true, id: 'c', round: 1, turn: 2 };
    expect(stampFor('endOfTurn', combat)).toEqual({ combatId: 'c', round: 1, turn: 2 });
    expect(stampFor('endOfTurn', null)).toBeNull();
    expect(stampFor('scene')).toEqual({ epoch: 1 });
    expect(isExpired({ until: 'endOfTurn', stamp: { combatId: 'c', round: 1, turn: 2 } }, combat)).toBe(false);
    expect(isExpired({ until: 'endOfTurn', stamp: { combatId: 'c', round: 1, turn: 2 } }, { ...combat, turn: 3 })).toBe(true);
    expect(isExpired({ until: 'scene', stamp: { epoch: 0 } })).toBe(true);
    expect(isExpired({ until: 'endOfTurn', stamp: null })).toBe(false);
    expect(isExpired(null)).toBe(false);
  });

  test('a toggle switched on for a turn reads off afterwards', async () => {
    const item = makeItem([{ type: 'Toggle', key: 'stance' }]);
    const actor = makeActor([], { items: [item] });
    game.combat = { started: true, id: 'c', round: 1, turn: 0 };
    await runSteps([{ do: 'setToggle', key: 'stance', value: true, until: 'endOfTurn' }], stepContext({ actor, item, targets: [] }));
    expect(toggleOf(item, 'stance')).toBe(true);
    game.combat.turn = 1;
    expect(toggleOf(item, 'stance')).toBe(false);
    await runSteps([{ do: 'setToggle', key: 'stance', value: 'false' }], stepContext({ actor, item, targets: [] }));
    expect(item.flags.essence20.rules.toggleUntil.stance).toBeNull();
  });

  test('items given for a while are swept once they run out', async () => {
    const timed = makeItem([], { flags: { essence20: { rulesExpiry: { until: 'endOfRound', stamp: { combatId: 'c', round: 1, turn: 0 } } } } });
    const lasting = makeItem([]);
    const actor = makeActor([], { items: [timed, lasting] });
    game.combat = { started: true, id: 'c', round: 1, turn: 3 };
    expect(await sweepExpired(actor)).toEqual([]);
    game.combat.round = 2;
    expect(await sweepExpired(actor)).toEqual([timed.id]);
    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', [timed.id]);
    expect(stepErrors([{ do: 'grant', uuid: 'x', until: 'forever' }])[0]).toMatch(/until must be/);
  });
});

describe('events', () => {
  test('hit and miss Triggers land on the target, with an outcome filter', async () => {
    const foe = makeActor([], { name: 'Foe' });
    const actor = makeActor([
      { type: 'Trigger', event: 'hit', steps: [{ do: 'chat', text: 'hit {target}' }] },
      { type: 'Trigger', event: 'hit', outcome: 'crit', steps: [{ do: 'chat', text: 'crit {target}' }] },
      { type: 'Trigger', event: 'miss', when: ['target:status:prone'], steps: [{ do: 'chat', text: 'miss' }] },
    ]);
    await fireTriggers(actor, 'hit', { outcome: 'success', targets: [foe] });
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('hit Foe');
    await fireTriggers(actor, 'hit', { outcome: 'crit', targets: [foe] });
    expect(ChatMessage.create).toHaveBeenCalledTimes(3);
    await fireTriggers(actor, 'miss', { targets: [foe] });
    expect(ChatMessage.create).toHaveBeenCalledTimes(3);
    foe.statuses.add('prone');
    await fireTriggers(actor, 'miss', { targets: [foe] });
    expect(ChatMessage.create).toHaveBeenCalledTimes(4);
  });

  test('the post-roll hook fires hit and miss for each attacked target', async () => {
    const foe = makeActor([], { name: 'Foe' });
    const other = makeActor([], { name: 'Other' });
    const actor = makeActor([{ type: 'Trigger', event: 'hit', steps: [{ do: 'chat', text: 'hit {target}' }] }, { type: 'Trigger', event: 'miss', steps: [{ do: 'chat', text: 'missed {target}' }] }]);
    const weapon = { type: 'weaponEffect', system: {} };
    global.fromUuidSync = uuid => (uuid == 'Item.w' ? weapon : actors.get(uuid) ?? null);
    const postRoll = registrySnapshot().postRoll.at(-1);
    await postRoll(actor, [{ success: true }], {}, { rider: { itemUuid: 'Item.w' }, hits: [{ target: foe, hit: true }, { target: other, hit: false }] });
    const lines = ChatMessage.create.mock.calls.map(call => call[0].content).join(' ');
    expect(lines).toContain('hit Foe');
    expect(lines).toContain('missed Other');
  });

  test('an item\'s own "added" Triggers run when it joins an actor', async () => {
    const item = makeItem([{ type: 'Trigger', event: 'added', steps: [{ do: 'heal', amount: 2 }] }, { type: 'Trigger', event: 'added', when: ['self:morphed'], steps: [{ do: 'heal', amount: 50 }] }]);
    const actor = makeActor([], { items: [item] });
    await fireItemAdded(actor, item);
    expect(actor.system.health.value).toBe(7);
  });

  test('new events are valid and read out', () => {
    expect(validateRule({ type: 'Trigger', event: 'conditionGained', when: ['self:status:frightened'], steps: [] })).toEqual([]);
    expect(summarizeRule({ type: 'Trigger', event: 'hit', outcome: 'crit', steps: [{ do: 'applyCondition' }] })).toBe('When an attack or spell hits (crit): apply condition');
  });
});

describe('immunity and stacking', () => {
  test('immunity clears Snags or downshifts after the dialog', () => {
    const actor = makeActor([{ type: 'RollModifier', when: ['skill:might'], immune: ['snag', 'downshift'] }]);
    const options = { snag: true, shiftDown: 2 };
    applyRuleImmunity(actor, options, { rolledSkill: 'might' });
    expect(options).toEqual({ snag: false, shiftDown: 0 });
    const other = { snag: true, shiftDown: 2 };
    applyRuleImmunity(actor, other, { rolledSkill: 'athletics' });
    expect(other).toEqual({ snag: true, shiftDown: 2 });
    expect(validateRule({ type: 'RollModifier', immune: ['snag'] })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', immune: ['edge'] })[0]).toMatch(/immune can only list/);
    expect(summarizeRule({ type: 'RollModifier', immune: ['snag'] })).toBe('ignores Snags');
  });

  test('only the strongest of a stacking group counts', () => {
    const actor = makeActor([
      { type: 'RollModifier', label: 'Small', stack: 'armor', upshift: 1 },
      { type: 'RollModifier', label: 'Big', stack: 'armor', upshift: 2 },
      { type: 'RollModifier', label: 'Other', upshift: 1 },
      { type: 'Defense', defense: 'toughness', amount: 1, stack: 'plating' },
      { type: 'Defense', defense: 'toughness', amount: 3, stack: 'plating' },
    ]);
    expect(ruleRollSources(actor, null, {}).sources.map(s => s.label).sort()).toEqual(['Big', 'Other']);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(13);
    expect(strongestPerGroup([], () => 0)).toEqual([]);
  });
});

describe('new condition tags', () => {
  test('terrain, environment and names', () => {
    const self = { name: 'Head Librarian', statuses: new Set(), system: {} };
    setWorldLookups({ terrain: () => null, environment: () => 'normal' });
    expect(evaluateTag('terrain:wild', contextFor({ self }))).toBeNull();
    setWorldLookups({ terrain: () => 'desert', environment: () => 'lowGravity' });
    expect(evaluateTag('terrain:wild', contextFor({ self }))).toBe(true);
    expect(evaluateTag('terrain:desert', contextFor({ self }))).toBe(true);
    expect(evaluateTag('terrain:urban', contextFor({ self }))).toBe(false);
    expect(evaluateTag('environment:lowGravity', contextFor({ self }))).toBe(true);
    setWorldLookups({ terrain: () => 'urban', environment: () => null });
    expect(evaluateTag('terrain:wild', contextFor({ self }))).toBe(false);
    expect(evaluateTag('environment:vacuum', contextFor({ self }))).toBeNull();
    expect(evaluateTag('target:name~librarian', contextFor({ self, other: self }))).toBe(true);
    expect(evaluateTag('self:name~mayor', contextFor({ self }))).toBe(false);
  });

  test('roll kinds and damage types', () => {
    expect(evaluateTag('roll:shove', contextFor({ dataset: { isShove: true } }))).toBe(true);
    expect(evaluateTag('roll:downshifted', contextFor({ pendingShiftDown: 0 }))).toBe(false);
    expect(evaluateTag('attack:unarmed', contextFor({ isAttack: true, item: { type: 'weaponEffect', flags: {} } }))).toBe(true);
    expect(evaluateTag('attack:unarmed', contextFor({ isAttack: true, item: { type: 'weaponEffect', flags: { essence20: { parentId: 'w' } } } }))).toBe(false);
  });

  test('vehicle crew and driving', () => {
    const driver = makeActor([]);
    const rider = makeActor([]);
    const truck = makeActor([], { type: 'vehicle', crew: { a: { uuid: driver.uuid, vehicleRole: 'driver' }, b: { uuid: rider.uuid } } });
    game.actors.contents = [driver, rider, truck];
    expect(evaluateTag('vehicle:driving', contextFor({ self: driver }))).toBe(true);
    expect(evaluateTag('vehicle:driving', contextFor({ self: rider }))).toBe(false);
    expect(evaluateTag('vehicle:crew', contextFor({ self: rider }))).toBe(true);
    expect(evaluateTag('vehicle:crew', contextFor({ self: makeActor([]) }))).toBe(false);
    expect(evaluateTag('vehicle:other', contextFor({ self: rider }))).toBeNull();
  });

  test('allies and enemies within a distance', () => {
    const mine = { center: { x: 0, y: 0 }, document: { disposition: 1 } };
    const self = makeActor([], { token: mine });
    const friend = makeActor([], { token: { center: { x: 5, y: 0 }, document: { disposition: 1 } } });
    const foe = makeActor([], { token: { center: { x: 30, y: 0 }, document: { disposition: -1 } } });
    friend.getActiveTokens()[0].actor = friend;
    foe.getActiveTokens()[0].actor = foe;
    global.canvas = { grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) }, tokens: { placeables: [mine, friend.getActiveTokens()[0], foe.getActiveTokens()[0]] } };
    mine.actor = self;
    expect(evaluateTag('ally:within:10', contextFor({ self }))).toBe(true);
    expect(evaluateTag('ally:within:2', contextFor({ self }))).toBe(false);
    expect(evaluateTag('enemy:within:10', contextFor({ self }))).toBe(false);
    expect(evaluateTag('enemy:within:30', contextFor({ self }))).toBe(true);
    expect(evaluateTag('enemy:near', contextFor({ self }))).toBeNull();
    delete global.canvas;
    expect(evaluateTag('ally:within:10', contextFor({ self }))).toBe(false);
  });

  test('scene names and item elements', () => {
    expect(evaluateTag('scene:name~library', contextFor({}))).toBe(true);
    expect(evaluateTag('scene:name~desert', contextFor({}))).toBe(false);
    expect(evaluateTag('scene:other', contextFor({}))).toBeNull();
    const weapon = { id: 'w', system: { elementChoice: 'fire' } };
    const effect = { system: { damageType: 'element' }, flags: { essence20: { parentId: 'w' } }, parent: { items: { get: () => weapon } } };
    expect(evaluateTag('item:element:fire', contextFor({ item: effect }))).toBe(true);
    expect(evaluateTag('item:element:cold', contextFor({ item: { system: { damageType: 'cold' } } }))).toBe(true);
  });
});

describe('gaps closed for conversions', () => {
  test('a limited modifier applies until its uses are spent, then drops out', async () => {
    const actor = makeActor([{ type: 'RollModifier', label: 'Steel Trap', when: ['skill:science'], specialize: true, upshift: 1, limit: { per: 'scene', max: 1 } }]);
    actor.setFlag = async (scope, key, value) => foundry.utils.setProperty(actor.flags[scope] ??= {}, key, value);
    actor.getFlag = (scope, key) => foundry.utils.getProperty(actor.flags[scope] ?? {}, key);
    const first = ruleRollSources(actor, null, { rolledSkill: 'science' });
    expect(first.sources[0]).toMatchObject({ label: 'Steel Trap', shiftUp: 1 });
    expect(first.consumes).toEqual([{ ext: 'rulesLimit', actorUuid: actor.uuid, itemId: actor.items.contents[0].id, index: 0 }]);
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(true);
    await consumeLimited(first.consumes[0], async () => actor);
    expect(ruleRollSources(actor, null, { rolledSkill: 'science' }).sources).toEqual([]);
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(false);
    await consumeLimited({ actorUuid: 'gone' }, async () => null);
    expect(validateRule({ type: 'RollModifier', upshift: 1, limit: { per: 'week' } })[0]).toMatch(/limit.per/);
    expect(summarizeRule({ type: 'RollModifier', upshift: 1, limit: { per: 'scene', max: 1 } })).toBe('↑1, 1/scene');
  });

  test('ignoring a number of downshifts', () => {
    const actor = makeActor([{ type: 'RollModifier', when: ['skill:alertness'], ignoreDownshift: 1 }]);
    const options = { shiftDown: 2 };
    applyRuleImmunity(actor, options, { rolledSkill: 'alertness' });
    expect(options.shiftDown).toBe(1);
    const none = { shiftDown: 0 };
    applyRuleImmunity(actor, none, { rolledSkill: 'alertness' });
    expect(none.shiftDown).toBe(0);
    expect(summarizeRule({ type: 'RollModifier', ignoreDownshift: 1 })).toBe('ignores 1 ↓');
  });

  test('a banked bonus can make the next roll Specialized', async () => {
    const actor = makeActor([]);
    actor.update = async data => {
      for (const [key, value] of Object.entries(data)) {
        foundry.utils.setProperty(actor, key, value);
      }
    };

    await runSteps([{ do: 'bank', specialize: true, appliesWhen: ['skill:science'] }], stepContext({ actor, item: makeItem([]), targets: [] }));
    expect(ruleSpecializes(actor, 'science', null, {})).toBe(true);
    expect(ruleSpecializes(actor, 'might', null, {})).toBe(false);
  });

  test('"until the encounter ends"', () => {
    expect(stampFor('encounter')).toEqual({ epoch: 1 });
    expect(isExpired({ until: 'encounter', stamp: { epoch: 1 } })).toBe(false);
    expect(isExpired({ until: 'encounter', stamp: { epoch: 0 } })).toBe(true);
    expect(stepErrors([{ do: 'grant', uuid: 'x', until: 'encounter' }])).toEqual([]);
  });
});

describe('sessions and transforming', () => {
  test('a per-session limit resets when the session counter moves on', async () => {
    const { limitKey, recordUse, usesLeft } = await import('./limits.mjs');
    const item = makeItem([]);
    const actor = makeActor([], { items: [item] });
    actor.getFlag = (scope, key) => foundry.utils.getProperty(actor.flags[scope] ?? {}, key);
    actor.setFlag = async (scope, key, value) => foundry.utils.setProperty(actor.flags[scope] ??= {}, key, value);
    let session = 1;
    game.settings.get = (scope, key) => (key == 'q2SessionEpoch' ? session : 1);
    const rule = { limit: { per: 'session', max: 1 } };
    expect(usesLeft(actor, rule, item, 0)).toBe(1);
    await recordUse(actor, rule, item, 0);
    expect(usesLeft(actor, rule, item, 0)).toBe(0);
    session = 2;
    expect(usesLeft(actor, rule, item, 0)).toBe(1);
    expect(limitKey(rule, item, 0)).toBe(`${item.id}-0`);
  });

  test('self:canTransform', () => {
    expect(evaluateTag('self:canTransform', contextFor({ self: { system: { canTransform: true } } }))).toBe(true);
    expect(evaluateTag('self:canTransform', contextFor({ self: { system: {} } }))).toBe(false);
  });
});
