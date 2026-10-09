import { jest } from '@jest/globals';

/**
 * Round 15, part "dice" (docs/rules-batches/slDice15.md): the engine pieces themselves - rule types, params, tags,
 * durations, recipients and steps - apart from the items that use them (rules/conv15-dice.test.js).
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const storyPoints = { canWrite: true, granted: [] };
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  canWriteStoryPoints: () => storyPoints.canWrite,
  poolFor: actor => (actor?.type == 'npc' ? 'gm' : 'story'),
  requestStoryPointGrant: jest.fn(async (actor, amount, options) => storyPoints.granted.push({ amount, pool: options?.pool ?? 'story' })),
  canSpendForActor: () => true,
  spendForActor: jest.fn(async () => true),
  hasStoryPointsAvailable: () => true,
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex, ruleId } = await import('./index.mjs');
const { validateRule, TRIGGER_EVENTS } = await import('./types.mjs');
const { contextFor, evaluate, registerCheck } = await import('./predicate.mjs');
const { stampFor, isExpired, isValidUntil } = await import('./expiry.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { ruleDefenseSwap } = await import('./plugins/combat/defense-swap.mjs');
const { ruleDamageFloor } = await import('./plugins/combat/damage-floor.mjs');
const { ruleCritImmune } = await import('./plugins/combat/crit-immune.mjs');
const { ruleSnagOrMiss } = await import('./plugins/combat/snag-or-miss.mjs');
const { tradeRuleUpshifts } = await import('./plugins/rolls/upshift-trade.mjs');
const { ruleClearsPenalties } = await import('./plugins/dialog/switch-clear-penalties.mjs');
const { targetTagHelpers } = await import('./plugins/tags/dice-target-tags.mjs');
const { NON_DAMAGE_EFFECT_TYPES } = await import('./plugins/tags/violent-tags.mjs');

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor(name, rules = [], extra = {}) {
  const list = [];
  const actor = {
    id: `a${nextId++}`, name, type: extra.type ?? 'playerCharacter', isOwner: true, statuses: new Set(), effects: [],
    flags: { essence20: {} }, system: { skills: {}, health: { value: 5, max: 10 }, powers: { personal: { value: 3 } }, ...(extra.system ?? {}) },
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => [],
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }

      rebuildIndex(this);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  if (rules.length) {
    const item = { id: `i${nextId++}`, name: `${name} item`, type: 'perk', flags: { essence20: {} }, system: { rules }, parent: actor };
    item.uuid = `Item.${item.id}`;
    list.push(item);
  }

  rebuildIndex(actor);
  return actor;
}

beforeEach(() => {
  global.game = { combat: null, user: { targets: new Set() }, i18n: { localize: key => key, format: key => key, has: () => false }, settings: { get: () => 1 } };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) }, applications: { api: { DialogV2: { confirm: jest.fn(async () => true) } } } };
  global.canvas = undefined;
  storyPoints.canWrite = true;
  storyPoints.granted.length = 0;
});

describe('validation of the round 15 dice pieces', () => {
  test('new rule types and params', () => {
    expect(validateRule({ type: 'EnergonSpendBonus', upshift: 1, limit: { per: 'round' } })).toEqual([]);
    expect(validateRule({ type: 'DefenseSwap', from: 'any', to: 'toughness' })).toEqual([]);
    expect(validateRule({ type: 'DefenseSwap', from: 'evasion', to: 'any' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'CritImmune', scope: 'aura', radius: 10, affects: 'all' })).toEqual([]);
    expect(validateRule({ type: 'DamageFloor', floor: 3 })).toEqual([]);
    expect(validateRule({ type: 'DamageFloor' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'SnagOrMiss', limit: { per: 'round' } })).toEqual([]);
    expect(validateRule({ type: 'CritDowngrade', prompt: 'E20.ConsistentPrompt', steps: [{ do: 'bank', upshift: 1 }] })).toEqual([]);
    expect(validateRule({ type: 'CritDowngrade' }).length).toBeGreaterThan(0);
    expect(validateRule({ type: 'DialogSwitch', label: 'x', spend: { max: 10 }, tradeUpshifts: 2 })).toEqual([]);
    expect(validateRule({ type: 'DialogSwitch', label: 'x', clearPenalties: true })).toEqual([]);
    expect(validateRule({ type: 'HitMultiplier', stage: 'late', multiply: 2 })).toEqual([]);
    expect(validateRule({ type: 'Defense', defense: 'toughness', mode: 'ignoreArmor', points: 1, outgoing: true })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', immune: ['evasiveManeuvers'] })).toEqual([]);
    expect(validateRule({ type: 'RollModifier', scope: 'incoming', immune: ['voidArmorIgnore'] })).toEqual([]);
    expect(TRIGGER_EVENTS).toContain('rollEnergonSpent');
    expect(validateRule({ type: 'Trigger', event: 'hit', steps: [{ do: 'mark', key: 'x', to: 'target', until: 'throughRoundPlus2' }] })).toEqual([]);
    expect(validateRule({ type: 'PreCast', steps: [{ do: 'setTargets', to: 'nearestEnemies:3' }] })).toEqual([]);
    expect(validateRule({ type: 'Use', label: 'x', steps: [{ do: 'cureAll', to: 'targetOrSelf' }] })).toEqual([]);
  });
});

describe('until: throughRoundPlus2', () => {
  test('rounds r..r+2 of the combat it started in; over outside it', () => {
    expect(isValidUntil('throughRoundPlus2')).toBe(true);
    const combat = { id: 'c1', round: 3 };
    const entry = { until: 'throughRoundPlus2', stamp: stampFor('throughRoundPlus2', combat) };
    expect([isExpired(entry, combat), isExpired(entry, { id: 'c1', round: 5 }), isExpired(entry, { id: 'c1', round: 6 })]).toEqual([false, false, true]);
    expect([isExpired(entry, { id: 'c2', round: 3 }), isExpired(entry, null)]).toEqual([true, true]);
    expect(isExpired({ until: 'throughRoundPlus2', stamp: stampFor('throughRoundPlus2', null) }, combat)).toBe(true);
  });
});

describe('tags', () => {
  test('roll:finalDie:<op><die> and roll:baseDie', () => {
    const ask = (tag, extra) => evaluate([tag], contextFor({ self: makeActor('A'), ...extra }));
    expect([ask('roll:finalDie:<=d4', { finalShift: 'd4' }), ask('roll:finalDie:<=d4', { finalShift: 'd6' }), ask('roll:finalDie:>=d8', { finalShift: 'd10' }), ask('roll:finalDie:=d6', { finalShift: 'd6' })]).toEqual([true, false, true, true]);
    expect(ask('roll:finalDie:<d4', {})).toBe(null);
    expect([ask('roll:baseDie:d2', { baseShift: 'd2' }), ask('roll:baseDie:d2', { baseShift: 'd4' })]).toEqual([true, false]);
  });

  test('self:uuidIsVar:<key> and holder:check:<name>', () => {
    const me = makeActor('Me');
    expect([evaluate(['self:uuidIsVar:who'], contextFor({ self: me, vars: { who: me.uuid } })), evaluate(['self:uuidIsVar:who'], contextFor({ self: me, vars: { who: 'Actor.x' } }))]).toEqual([true, false]);
    let up = true;
    try {
      registerCheck('personalShield', () => up);
    } catch {
      // registered already
    }

    const holder = makeActor('Holder');
    const ask = () => evaluate(['holder:check:personalShield'], contextFor({ self: makeActor('Other'), holder }));
    expect(ask()).toBe(true);
    up = false;
    expect(ask()).toBe(false);
  });

  test('item:healthDamage reads NON_DAMAGE_EFFECT_TYPES', () => {
    const ask = system => evaluate(['item:healthDamage'], contextFor({ self: makeActor('A'), item: { type: 'weaponEffect', system } }));
    expect(NON_DAMAGE_EFFECT_TYPES).toContain('stun');
    expect([ask({ damageValue: 2, damageType: 'blunt' }), ask({ damageValue: 2, damageType: 'stun' }), ask({ damageValue: 0, damageType: 'blunt' })]).toEqual([true, false, false]);
  });
});

describe('recipients and steps', () => {
  test('to: nearestEnemies:<n> - nearest first, a set of actors; unsorted without a grid', async () => {
    const me = makeActor('Me');
    const tokenOf = (actor, x) => ({ actor, center: { x, y: 0 } });
    me.getActiveTokens = () => [tokenOf(me, 0)];
    const foes = [tokenOf(makeActor('Far'), 40), tokenOf(makeActor('Near'), 5), tokenOf(makeActor('Mid'), 20)];
    targetTagHelpers.getNearbyEnemyTokens = () => foes;
    global.canvas = { tokens: { setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    const ctx = stepContext({ actor: me, item: null, rule: {} });
    await runSteps([{ do: 'setTargets', to: 'nearestEnemies:2' }], ctx);
    expect(ctx.targets.map(actor => actor.name)).toEqual(['Near', 'Mid']);
    global.canvas = { tokens: { setTargets: jest.fn() } };
    const flat = stepContext({ actor: me, item: null, rule: {} });
    await runSteps([{ do: 'setTargets', to: 'nearestEnemies:2' }], flat);
    expect(flat.targets.map(actor => actor.name)).toEqual(['Far', 'Near']);
    targetTagHelpers.getNearbyEnemyTokens = null;
  });

  test('cureAll: full Health, every status off, Defeated included', async () => {
    const hurt = makeActor('Hurt');
    hurt.statuses = new Set(['prone']);
    hurt.toggleStatusEffect = jest.fn(async status => hurt.statuses.delete(status));
    await runSteps([{ do: 'cureAll', to: 'self' }], stepContext({ actor: hurt, item: null, rule: {} }));
    expect(hurt.system.health.value).toBe(10);
    expect(hurt.toggleStatusEffect.mock.calls.map(call => call[0])).toEqual(['prone', 'defeated']);
  });

  test('grantStoryPoint: count and pool; stops quietly without a writer unless optional', async () => {
    const pc = makeActor('PC');
    const npc = makeActor('NPC', [], { type: 'npc' });
    await runSteps([{ do: 'grantStoryPoint', count: 2 }, { do: 'grantStoryPoint', pool: 'actor' }], stepContext({ actor: npc, item: null, rule: {} }));
    expect(storyPoints.granted).toEqual([{ amount: 2, pool: 'story' }, { amount: 1, pool: 'gm' }]);
    storyPoints.canWrite = false;
    storyPoints.granted.length = 0;
    expect(await runSteps([{ do: 'grantStoryPoint' }, { do: 'cureAll', to: 'self' }], stepContext({ actor: pc, item: null, rule: {} }))).toBe(false);
    expect(await runSteps([{ do: 'grantStoryPoint', optional: true }], stepContext({ actor: pc, item: null, rule: {} }))).not.toBe(false);
    expect(storyPoints.granted).toEqual([]);
  });
});

describe('roll-time helpers', () => {
  test('ruleDefenseSwap: the first that holds for the Defense; to == from is skipped', () => {
    const attacker = makeActor('A', [
      { type: 'DefenseSwap', from: 'toughness', to: 'toughness' },
      { type: 'DefenseSwap', from: 'any', to: 'willpower', when: ['roll:switch:mind'] },
    ]);
    expect([ruleDefenseSwap(attacker, null, { switches: ['mind'] }, 'toughness'), ruleDefenseSwap(attacker, null, { switches: [] }, 'toughness'), ruleDefenseSwap(attacker, null, {}, null)]).toEqual(['willpower', 'toughness', null]);
  });

  test('ruleDamageFloor: the biggest floor that holds', () => {
    const zord = makeActor('Z', [{ type: 'DamageFloor', floor: 3 }, { type: 'DamageFloor', floor: 5, when: ['attack:melee'] }]);
    expect([ruleDamageFloor(zord, { item: { type: 'weaponEffect', system: { classification: { style: 'melee' } } } }), ruleDamageFloor(zord, {})]).toEqual([5, 3]);
  });

  test('ruleCritImmune: own rules with when; no rules, not immune', () => {
    const tank = makeActor('T', [{ type: 'CritImmune', when: ['attack'] }]);
    expect([ruleCritImmune(tank, null, { item: { type: 'weaponEffect', system: {} } }), ruleCritImmune(tank, null, {}), ruleCritImmune(makeActor('U'), null, {})]).toEqual([true, false, false]);
  });

  test('ruleSnagOrMiss: no limit - every roll', () => {
    const ghost = makeActor('G', [{ type: 'SnagOrMiss' }]);
    expect(ruleSnagOrMiss(makeActor('R'), ghost, {})?.label).toBe('G item');
    expect(ruleSnagOrMiss(makeActor('R'), ghost, {})).not.toBe(null);
  });

  test('tradeRuleUpshifts: traded no more than the roll has; damage per N traded', () => {
    const siege = makeActor('S', [{ type: 'DialogSwitch', label: 'Trade', spend: { max: 10 }, tradeUpshifts: 2 }]);
    const name = ruleId(siege.items.contents[0], 0);
    const options = { shiftUp: 3, ext: { [name]: 5 } };
    expect(tradeRuleUpshifts(siege, options, {})).toEqual({ damage: 1, sources: ['Trade'] });
    expect(options.shiftUp).toBe(0);
  });

  test('ruleClearsPenalties reads the ticked box, offered or not', () => {
    const bot = makeActor('B', [{ type: 'DialogSwitch', label: 'Clear', clearPenalties: true, limit: { per: 'scene' } }]);
    const name = ruleId(bot.items.contents[0], 0);
    expect([ruleClearsPenalties(bot, { ext: { [name]: true } }), ruleClearsPenalties(bot, { ext: {} }), ruleClearsPenalties(null, {})]).toEqual([true, false, false]);
  });
});
