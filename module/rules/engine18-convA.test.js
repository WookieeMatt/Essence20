import { jest } from '@jest/globals';

/**
 * Round 18, convA (docs/rules-batches/slConvA18.md): the engine pieces, with inline rules - ConditionHalving
 * (steps.mjs#registerConditionDuration), SkillSubstitution stage attack, applyingDamage redirectTo, BeforeRoll scope
 * marked, HitRider stage late + replace, HeldUse.
 */

global.Hooks = { on: jest.fn(), once: () => 0, callAll: () => {} };
const chat = [];
global.ChatMessage = { create: jest.fn(async data => chat.push(data)), getSpeaker: ({ actor } = {}) => ({ actor: actor?.id ?? null }) };
global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
global.game = {
  settings: { get: () => 1 }, combat: null, i18n: null,
  user: { id: 'u1', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true }, contents: [] }, actors: [], scenes: [],
};

jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const conditions = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds, timing) => conditions.push({ name: actor.name, status, rounds, until: timing?.expiry ?? null })),
  turnBoundTiming: jest.fn((until, actor) => ({ value: 0, expiry: until, combatantId: actor?.name ?? null })),
}));

let nextId = 1;
const byUuid = new Map();
global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
global.fromUuid = async uuid => byUuid.get(uuid) ?? null;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  if (last.startsWith('-=') || (globalThis.foundry?.data?.operators?.ForcedDeletion && value instanceof globalThis.foundry.data.operators.ForcedDeletion)) {
    delete parent[last.replace(/^-=/, '')];
  } else {
    parent[last] = value;
  }
}

global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { setProperty: setPath, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` } };
global.CONFIG = {
  E20: {
    skillToEssence: { might: 'strength', brawn: 'strength', finesse: 'speed' }, damageTypes: {},
    skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
  },
};

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { runPreRoll } = await import('../mechanics/item-hooks.mjs');
const { halvedDuration } = await import('./plugins/effects/condition-halving.mjs');
const { ruleAttackSkill } = await import('./plugins/rolls/attack-skill-substitution.mjs');
const { ruleSelfRedirect, takeSelfRedirect } = await import('./plugins/combat/self-redirect.mjs');
const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
const { ruleLateHitRiders } = await import('./plugins/combat/late-hit-rider.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { ruleHeldUses } = await import('./plugins/resources/held-uses.mjs');

function makeItem(data) {
  const item = { id: `i${nextId++}`, name: 'Perk', type: 'perk', effects: [], flags: { essence20: {} }, system: {}, ...data };
  item.uuid = `Item.${item.id}`;
  item.update = jest.fn(async update => Object.entries(update).forEach(([key, value]) => setPath(item, key, value)));
  byUuid.set(item.uuid, item);
  return item;
}

const withRules = (rules, extra = {}) => makeItem({ ...extra, system: { ...(extra.system ?? {}), rules } });

function makeActor(items = [], extra = {}) {
  const list = [...items];
  const actor = {
    id: `a${nextId++}`, name: extra.name ?? 'Hero', type: 'playerCharacter', isOwner: true, flags: { essence20: { ...(extra.flags ?? {}) } },
    statuses: new Set(), system: { skills: { might: { shift: 'd8' }, brawn: { shift: 'd12' }, finesse: { shift: 'd10' } }, ...(extra.system ?? {}) },
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    prototypeToken: { disposition: 1 }, getActiveTokens: () => [],
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => String(key).split('.').reduce((o, k) => o?.[k], actor.flags[scope]);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
  actor.update = jest.fn(async update => {
    Object.entries(update).forEach(([key, value]) => setPath(actor, key, value));
    rebuildIndex(actor);
  });
  list.forEach(item => {
    item.parent = actor;
  });
  byUuid.set(actor.uuid, actor);
  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  chat.length = 0;
  conditions.length = 0;
  global.game.user.targets = new Set();
  global.game.actors = [];
  ui.notifications.warn.mockClear();
});

describe('ConditionHalving', () => {
  test('validates; rounds halve rounded down (never below 1), and only the listed Conditions', () => {
    expect(validateRule({ type: 'ConditionHalving', conditions: ['frightened'] })).toEqual([]);
    expect(validateRule({ type: 'ConditionHalving', conditions: [] })).not.toEqual([]);
    const holder = makeActor([withRules([{ type: 'ConditionHalving', conditions: ['frightened'] }])]);
    expect(halvedDuration(holder, 'frightened', { rounds: 5 })).toEqual({ rounds: 2 });
    expect(halvedDuration(holder, 'frightened', { rounds: 3 })).toEqual({ rounds: 1 });
    expect(halvedDuration(holder, 'frightened', { rounds: 1 })).toEqual({ rounds: 1 });
    expect(halvedDuration(holder, 'prone', { rounds: 4 })).toBeNull();
  });

  test("'until the end of your next turn' ends as that turn starts - whoever's turn it counts", () => {
    const holder = makeActor([withRules([{ type: 'ConditionHalving', conditions: ['frightened'] }])]);
    const other = makeActor();
    expect(halvedDuration(holder, 'frightened', { until: 'endOfNextTurn', rounds: 0, untilActor: holder })).toEqual({ until: 'nextTurn' });
    expect(halvedDuration(holder, 'frightened', { until: 'endOfNextTurnOrScene', untilActor: holder })).toEqual({ until: 'nextTurnOrScene' });
    expect(halvedDuration(holder, 'frightened', { until: 'endOfNextTurn', untilActor: other })).toEqual({ until: 'nextTurn' });
  });

  test("its `when` sees the one applying it as target:, and applyCondition reads it per recipient", async () => {
    const holder = makeActor([withRules([{ type: 'ConditionHalving', conditions: ['frightened'], when: ['target:name~Bully'] }])], { name: 'Brave' });
    const plain = makeActor([], { name: 'Plain' });
    const bully = makeActor([], { name: 'Bully' });
    await runSteps([{ do: 'applyCondition', condition: 'frightened', rounds: 4, to: 'targets' }], stepContext({ actor: bully, item: null, rule: {}, targets: [holder, plain] }));
    await runSteps([{ do: 'applyCondition', condition: 'frightened', rounds: 4, to: 'target' }], stepContext({ actor: makeActor([], { name: 'Nice' }), item: null, rule: {}, targets: [holder] }));
    expect(conditions).toEqual([
      { name: 'Brave', status: 'frightened', rounds: 2, until: null },
      { name: 'Plain', status: 'frightened', rounds: 4, until: null },
      { name: 'Brave', status: 'frightened', rounds: 4, until: null },
    ]);
  });
});

describe('SkillSubstitution stage: attack', () => {
  test('validates; replace swaps, bestOf only for a better die, `when` sees the attack', () => {
    expect(validateRule({ type: 'SkillSubstitution', stage: 'attack', from: 'might', to: 'brawn' })).toEqual([]);
    expect(validateRule({ type: 'SkillSubstitution', stage: 'later', from: 'might', to: 'brawn' })).not.toEqual([]);
    const melee = makeItem({ type: 'weaponEffect', system: { classification: { style: 'melee', skill: 'brawn' } } });
    const actor = makeActor([withRules([
      { type: 'SkillSubstitution', stage: 'attack', from: 'brawn', to: 'finesse', when: ['attack:melee'] },
      { type: 'SkillSubstitution', stage: 'attack', from: 'might', to: 'finesse', mode: 'bestOf' },
    ])]);
    expect(ruleAttackSkill(actor, melee, 'brawn')).toBe('finesse');
    const ranged = makeItem({ type: 'weaponEffect', system: { classification: { style: 'ranged', skill: 'brawn' } } });
    expect(ruleAttackSkill(actor, ranged, 'brawn')).toBe('brawn');
    // might d8 -> finesse d10 is better.
    expect(ruleAttackSkill(actor, melee, 'might')).toBe('finesse');
    actor.system.skills.might.shift = 'd12';
    expect(ruleAttackSkill(actor, melee, 'might')).toBe('might');
  });
});

describe('applyingDamage redirectTo', () => {
  test('the one hit may send it to the recipient; `when`, limit and steps count; the plain pass ignores it', async () => {
    const shelter = makeActor([], { name: 'Shelter' });
    const rule = { type: 'Trigger', event: 'applyingDamage', redirectTo: 'picked:refuge', when: ['not:target:name~Ghost'], limit: { per: 'scene', max: 1 },
      steps: [{ do: 'setVar', key: 'took', value: 1 }] };
    expect(validateRule(rule)).toEqual([]);
    const item = withRules([rule]);
    item.flags.essence20.rules = { choices: { refuge: shelter.uuid } };
    const holder = makeActor([item], { name: 'Holder' });
    expect(ruleSelfRedirect(holder, makeActor([], { name: 'Ghost' }))).toBeNull();
    const redirect = ruleSelfRedirect(holder, makeActor([], { name: 'Foe' }));
    expect(redirect).toEqual(expect.objectContaining({ protector: shelter, rule }));
    await takeSelfRedirect(redirect);
    expect(ruleSelfRedirect(holder, null)).toBeNull();
    // The plain applyingDamage pass on the holder doesn't run it.
    const landing = await applyingDamage(holder, 3, { redirect: false, ask: async () => true });
    expect(landing).toEqual({ target: holder, damage: 3, dropSecondary: false });
  });
});

describe('BeforeRoll scope marked', () => {
  test("validates with a mark; refuses the carrier's matching roll with the setter's message, runs its steps", async () => {
    expect(validateRule({ type: 'BeforeRoll', scope: 'marked', cancel: true })).not.toEqual([]);
    expect(validateRule({ type: 'BeforeRoll', mark: 'x', cancel: true })).not.toEqual([]);
    const rules = [
      { type: 'BeforeRoll', scope: 'marked', mark: 'hexed', when: ['skill:might'], cancel: true, message: '{name} is held by {holder}' },
      { type: 'BeforeRoll', scope: 'marked', mark: 'hexed', steps: [{ do: 'chat', text: 'Watched' }] },
    ];
    rules.forEach(rule => expect(validateRule(rule)).toEqual([]));
    const witch = makeActor([withRules(rules)], { name: 'Witch' });
    const victim = makeActor([], { name: 'Victim', flags: { ruleMarks: { hexed: { by: witch.uuid } } } });
    const free = makeActor([], { name: 'Free' });
    const blocked = { skill: 'might' };
    await runPreRoll(victim, blocked, null);
    expect(blocked.cancelRoll).toBe(true);
    expect(ui.notifications.warn).toHaveBeenCalledWith('Victim is held by Witch');
    const allowed = { skill: 'finesse' };
    await runPreRoll(victim, allowed, null);
    expect(allowed.cancelRoll).toBeUndefined();
    expect(chat.map(message => message.content)).toEqual(['Watched']);
    const own = { skill: 'might' };
    await runPreRoll(free, own, null);
    await runPreRoll(witch, own, null);
    expect(own.cancelRoll).toBeUndefined();
  });
});

describe('HitRider stage: late', () => {
  test('validates only with an option; read after the other riders, not by them; replace drops the own damage', () => {
    expect(validateRule({ type: 'HitRider', stage: 'late', note: 1 })).not.toEqual([]);
    expect(validateRule({ type: 'HitRider', note: 1, replace: true })).not.toEqual([]);
    const actor = makeActor([withRules([
      { type: 'HitRider', note: 2 },
      { type: 'HitRider', stage: 'late', option: { damage: '@var.damage + 1', damageType: 'cold', label: 'Chill' } },
      { type: 'HitRider', stage: 'late', replace: true, when: ['target:name~Wall'], option: { damage: '@var.damage', damageType: 'fire', key: 'burn' } },
    ])], { name: 'Hitter' });
    const tools = { damageBonusNote: (result, amount) => {
      result.damageValue += amount;
    } };
    const foe = makeActor([], { name: 'Foe' });
    const row = { damageValue: 3 };
    hitRiderOnAttack(actor, foe, row, {}, tools);
    expect(row).toEqual({ damageValue: 5 });
    ruleLateHitRiders(actor, foe, row, {});
    expect(row).toEqual({ damageValue: 5, riderOptions: [expect.objectContaining({ label: 'Chill', damageValue: 6, damageType: 'cold' })] });
    const wall = makeActor([], { name: 'Wall' });
    const wallRow = { damageValue: 4 };
    ruleLateHitRiders(actor, wall, wallRow, {});
    expect(wallRow.damageValue).toBeNull();
    expect(wallRow.riderOptions.map(option => [option.key ?? option.label, option.damageValue])).toEqual([[expect.stringMatching(/^rule/), 5], ['burn', 4]]);
    const none = { damageValue: 0 };
    ruleLateHitRiders(actor, wall, none, {});
    expect(none).toEqual({ damageValue: 0 });
  });
});

describe('HeldUse', () => {
  test('validates; holds `count` (a formula) of the spent uses while `when` holds, never more than are spent', () => {
    expect(validateRule({ type: 'HeldUse', count: 2 })).toEqual([]);
    const power = withRules([{ type: 'HeldUse', count: '1 + 1', when: ['self:name~Held'] }], { type: 'power', system: { usesSpent: 3 } });
    const held = makeActor([power], { name: 'Held' });
    expect(ruleHeldUses(held, power)).toBe(2);
    power.system.usesSpent = 1;
    expect(ruleHeldUses(held, power)).toBe(1);
    const other = withRules([{ type: 'HeldUse', when: ['self:name~Held'] }], { type: 'power', system: { usesSpent: 2 } });
    expect(ruleHeldUses(makeActor([other], { name: 'Free' }), other)).toBe(0);
    expect(ruleHeldUses(held, makeItem({ type: 'power', system: { usesSpent: 2 } }))).toBe(0);
  });
});
