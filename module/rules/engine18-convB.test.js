import { jest } from '@jest/globals';

/**
 * Round 18, convB (docs/rules-batches/slConvB18.md): the engine pieces - rule types HealthOverflow, PowerGate,
 * SummonArrival; updateActor notSpent; addEffect until (+ the timed-effect sweep) and its formatted name; ref
 * @rolePointsBonus; link scope drivenMegaform and tag megaform:everyDriver; steps storyPointsExpire and
 * buildSorcerousPower.
 */

global.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
const relay = { needsGmRelay: jest.fn(() => false), relayToGm: jest.fn(async () => true) };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => relay);
const pool = { value: 5 };
const storyPoints = {
  getStoryPoints: jest.fn(() => pool.value), setStoryPoints: jest.fn(async value => {
    pool.value = value;
    return true;
  }),
  canWriteStoryPoints: () => true, requestStoryPointGrant: jest.fn(), poolFor: () => 'story',
};
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => storyPoints);
const builder = { buildSorcerousPower: jest.fn(async () => null) };
jest.unstable_mockModule('./items/magic/temper-tempest-sorcery-builder.mjs', () => builder);

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { validateRule } = await import('./types.mjs');
const { evaluate, contextFor } = await import('./predicate.mjs');
const { runSteps, stepContext, stepErrors } = await import('./steps.mjs');
const { sweepExpired } = await import('./triggers.mjs');
const { linkedEntries } = await import('./links.mjs');
const { resolveValue } = await import('./formula.mjs');
const { healthOverflow, overflowSplit } = await import('./plugins/combat/health-overflow.mjs');
const { powerGateOpen } = await import('./plugins/resources/power-gate.mjs');
const { applySummonArrival } = await import('./plugins/zords/summon-arrival.mjs');
const expiring = await import('./plugins/resources/expiring-story-points.mjs');
const { runDamageModifiers } = await import('../mechanics/item-hooks.mjs');

let nextId = 1;
const setPath = (object, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((at, key) => (at[key] ??= {}), object)[last] = value;
};

const getPath = (object, path) => path.split('.').reduce((at, key) => at?.[key], object);

function actorWith(rules = [], { system = {}, flags = {}, type = 'playerCharacter', items = [] } = {}) {
  const list = [];
  const effects = [];
  const actor = {
    id: `a${nextId++}`, name: 'Actor', type, flags: { essence20: { ...flags } }, statuses: new Set(), isOwner: true,
    system: { level: 5, health: { value: 10, max: 10, bonus: 0 }, powers: { personal: { value: 3, max: 6 } }, immunities: {}, skills: {}, ...system },
    update: jest.fn(async function (data) {
      Object.entries(data).forEach(([key, value]) => setPath(this, key, value));
    }),
    setFlag: jest.fn(async function (scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    }),
    getFlag(scope, key) {
      return getPath(this.flags[scope], key);
    },
    async createEmbeddedDocuments(type, datas) {
      const made = datas.map(data => ({ ...data, id: `e${nextId++}`, parent: actor }));
      (type == 'ActiveEffect' ? effects : list).push(...made);
      rebuildIndex(actor);
      return made;
    },
    deleteEmbeddedDocuments: jest.fn(async (type, ids) => {
      const from = type == 'ActiveEffect' ? effects : list;
      ids.forEach(id => from.splice(from.findIndex(entry => entry.id == id), 1));
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const add = data => list.push({ id: `i${nextId++}`, name: data.name ?? 'Item', type: data.type ?? 'perk', flags: data.flags ?? {}, system: data.system ?? {}, parent: actor });
  if (rules.length) {
    add({ name: 'Rules', system: { rules } });
  }

  items.forEach(add);
  actor.items = Object.assign(list, { contents: list, get: id => list.find(item => item.id == id) });
  actor.effects = Object.assign(effects, { contents: effects });
  actor.getActiveTokens = () => [];
  rebuildIndex(actor);
  return actor;
}

const ruleItem = actor => actor.items.contents[0];

beforeEach(() => {
  global.game = {
    user: { id: 'gm', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true } },
    i18n: { localize: key => key, format: (key, data) => `${key} ${JSON.stringify(data ?? {})}`, has: () => true }, settings: { get: () => 1 }, combat: null, actors: [],
  };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(async data => data), getSpeaker: () => ({}) };
  global.CONFIG = { E20: { skills: {}, skillToEssence: {} } };
  global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { setProperty: setPath, getProperty: getPath, hasProperty: (o, p) => getPath(o, p) !== undefined }, applications: { api: { DialogV2: { confirm: jest.fn(async () => false) } } } };
  relay.needsGmRelay.mockReset().mockReturnValue(false);
  relay.relayToGm.mockClear();
  storyPoints.setStoryPoints.mockClear();
  builder.buildSorcerousPower.mockReset().mockResolvedValue(null);
  pool.value = 5;
});

describe('HealthOverflow', () => {
  test('the split keeps Health at `keep` until the pool is gone', () => {
    expect(overflowSplit(3, 4, 5)).toEqual({ health: 1, pool: 1 });
    expect(overflowSplit(3, 1, 5)).toEqual({ health: 0, pool: 0 });
    expect(overflowSplit(3, 4, 2)).toEqual({ health: 1, pool: 4 });
    expect(overflowSplit(5, 4, 6, 2)).toEqual({ health: 2, pool: 1 });
    expect(validateRule({ type: 'HealthOverflow', into: 'flags.x' })).toEqual(['into must be a system. path']);
    expect(validateRule({ type: 'HealthOverflow', into: 'system.powers.personal.value' })).toEqual([]);
  });

  test('a damage modifier: damage that would empty Health comes out of the pool, written as a loss', async () => {
    const actor = actorWith([{ type: 'HealthOverflow', into: 'system.powers.personal.value', when: ['self:data:flags.essence20.on', 'not:damage:stun'] }],
      { flags: { on: true }, system: { health: { value: 3, max: 10 }, powers: { personal: { value: 4, max: 6 } } } });
    expect(await healthOverflow(actor, 2, 'blunt')).toBe(2);
    expect(actor.update).not.toHaveBeenCalled();
    expect(await healthOverflow(actor, 5, 'blunt')).toBe(2);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 }, { essence20Loss: true });
    actor.system.powers.personal.value = 4;
    expect(await healthOverflow(actor, 5, 'stun')).toBe(5);
    actor.flags.essence20.on = false;
    expect(await healthOverflow(actor, 5, 'blunt')).toBe(5);
    actor.flags.essence20.on = true;
    actor.system.powers.personal.value = 0;
    expect(await healthOverflow(actor, 5, 'blunt')).toBe(5);
  });

  test('registered after the rules\' reductions: it shares out what is left of the hit', async () => {
    const actor = actorWith([
      { type: 'HealthOverflow', into: 'system.powers.personal.value' },
      { type: 'DamageReduction', amount: 1 },
    ], { system: { health: { value: 3, max: 10 }, powers: { personal: { value: 4, max: 6 } } } });
    // 5 damage, 1 reduced first: 4 lands - 2 off Health (kept at 1), 2 off the pool.
    expect(await runDamageModifiers(actor, 5, 'blunt', {})).toBe(2);
    expect(actor.system.powers.personal.value).toBe(2);
  });
});

describe('updateActor notSpent', () => {
  test('writes with the loss / refund options; without it, plainly', async () => {
    const actor = actorWith();
    await runSteps([{ do: 'updateActor', to: 'self', set: { 'system.health.value': 4 }, notSpent: true }], stepContext({ actor, item: ruleItem(actor) ?? null }));
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.health.value': 4 }, { essence20Loss: true, essence20Refund: true });
    await runSteps([{ do: 'updateActor', to: 'self', set: { 'system.health.value': 5 } }], stepContext({ actor }));
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.health.value': 5 });
  });
});

describe('addEffect until, the timed-effect sweep, the formatted name', () => {
  test('an effect on a recipient carries the duration and is swept once it runs out', async () => {
    const giver = actorWith([{ type: 'Use', steps: [] }]);
    giver.name = 'Sarge';
    const ally = actorWith();
    // A name with a placeholder is formatted; one without is only localised (engine12-h's case).
    global.game.i18n.localize = key => (key == 'E20.Named' ? 'Named ({name})' : key);
    const ctx = stepContext({ actor: giver, item: ruleItem(giver), targets: [ally] });
    await runSteps([{ do: 'addEffect', on: 'actor', to: 'target', name: 'E20.Named', until: 'scene', changes: [{ key: 'system.x', value: 2 }] }], ctx);
    const [effect] = ally.effects;
    expect(effect.name).toBe('E20.Named {"name":"Sarge"}');
    expect(effect.flags.essence20.rulesExpiry).toEqual({ until: 'scene', stamp: { epoch: expect.anything() } });
    expect(effect.changes).toEqual([{ key: 'system.x', mode: 2, value: '2' }]);
    await sweepExpired(ally);
    expect(ally.effects).toHaveLength(1);
    effect.flags.essence20.rulesExpiry.stamp.epoch = -1;
    await sweepExpired(ally);
    expect(ally.effects).toHaveLength(0);
    expect(ally.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [effect.id]);
  });

  test('until needs on: actor and a rule duration', () => {
    expect(stepErrors([{ do: 'addEffect', changes: [{ key: 'system.x', value: 1 }], until: 'scene' }]).join()).toMatch(/until needs on: actor/);
    expect(stepErrors([{ do: 'addEffect', on: 'actor', changes: [{ key: 'system.x', value: 1 }], until: 'scene' }])).toEqual([]);
  });
});

describe('@rolePointsBonus', () => {
  test('the base Role Points bonus, its 20th-level value at 20th level; a named one; 0 with none', () => {
    const points = { name: 'Reckless Abandon', type: 'rolePoints', system: { bonus: { value: 3, level20Value: 5 }, resource: { value: 2 } } };
    const actor = actorWith([], { items: [points] });
    expect(resolveValue('@rolePointsBonus', { actor })).toBe(3);
    expect(resolveValue('@rolePointsBonus.Reckless_Abandon', { actor })).toBe(3);
    actor.system.level = 20;
    expect(resolveValue('@rolePointsBonus', { actor })).toBe(5);
    expect(resolveValue('@rolePointsBonus', { actor: actorWith() })).toBe(0);
  });
});

describe('PowerGate', () => {
  test("a Power's activation is open only while its gate's `when` holds; no gate, open", () => {
    const actor = actorWith();
    const power = { type: 'power', parent: actor, system: { rules: [{ type: 'PowerGate', when: ['not:self:limitUsed:boost:encounter'] }] } };
    expect(powerGateOpen(power)).toBe(true);
    actor.flags.essence20.ruleUses = { boost: { epoch: 1, window: 'encounter', count: 1 } };
    expect(powerGateOpen(power)).toBe(false);
    expect(powerGateOpen({ type: 'power', parent: actor, system: {} })).toBe(true);
  });
});

describe('drivenMegaform and megaform:everyDriver', () => {
  function megazord(zords, subtype = ['megaformZord']) {
    const form = actorWith([], { type: 'megaform', system: { subtype, actors: Object.fromEntries(zords.map((zord, i) => [`z${i}`, { uuid: zord.uuid }])) } });
    return form;
  }

  function zordDrivenBy(driver) {
    return actorWith([], { type: 'zord', system: { actors: driver ? { d: { uuid: driver.uuid, vehicleRole: 'driver' } } : {} } });
  }

  test("a driver's rule reaches the Megazords its Zord is part of; the tag asks every participant's driver", () => {
    const red = actorWith([{ type: 'DamageModifier', direction: 'dealt', scaled: true, amount: 1, scope: 'drivenMegaform', stacks: false }], { flags: { opt: 'team' } });
    const blue = actorWith([{ type: 'DamageModifier', direction: 'dealt', scaled: true, amount: 1, scope: 'drivenMegaform', stacks: false }], { flags: { opt: 'team' } });
    const z1 = zordDrivenBy(red);
    const z2 = zordDrivenBy(blue);
    const form = megazord([z1, z2]);
    const all = [red, blue, z1, z2, form];
    global.fromUuidSync = uuid => all.find(actor => actor.uuid == uuid) ?? null;
    global.game.actors = Object.assign(all, { get: id => all.find(actor => actor.id == id), contents: all });
    // Both drivers hold the same item: stacks: false counts it once.
    expect(linkedEntries(form, 'DamageModifier').map(entry => entry.holder)).toEqual([red]);
    expect(linkedEntries(z1, 'DamageModifier')).toEqual([]);
    const tag = 'megaform:everyDriver:self:data:flags.essence20.opt=team';
    expect(evaluate([tag], contextFor({ self: form }))).toBe(true);
    blue.flags.essence20.opt = 'other';
    expect(evaluate([tag], contextFor({ self: form }))).toBe(false);
    blue.flags.essence20.opt = 'team';
    z2.system.actors = {};
    expect(evaluate([tag], contextFor({ self: form }))).toBe(false);
    expect(evaluate([tag], contextFor({ self: megazord([z1], ['megaformCombiner']) }))).toBe(false);
    expect(evaluate([tag], contextFor({ self: red }))).toBe(false);
  });
});

describe('storyPointsExpire', () => {
  test('in a combat it marks the actor; the GM books it; pool drops count; the combat ending takes back the unspent', async () => {
    const combatFlags = {};
    const combat = { id: 'c1', getFlag: (scope, key) => combatFlags[key], setFlag: jest.fn(async (scope, key, value) => {
      combatFlags[key] = value;
    }) };
    const actor = actorWith([{ type: 'Trigger', steps: [] }]);
    await runSteps([{ do: 'storyPointsExpire', message: 'E20.Lost' }], stepContext({ actor, item: ruleItem(actor) }));
    expect(actor.setFlag).not.toHaveBeenCalled();
    global.game.combat = combat;
    await runSteps([{ do: 'storyPointsExpire', count: 2, message: 'E20.Lost' }], stepContext({ actor, item: ruleItem(actor) }));
    const mark = actor.flags.essence20.expiringStoryPointsGrant;
    expect(mark).toEqual(expect.objectContaining({ combatId: 'c1', count: 2, message: 'E20.Lost' }));
    await expiring.onGrantMarked(actor, { flags: { essence20: { expiringStoryPointsGrant: mark } } });
    expect(combatFlags.expiringStoryPoints).toEqual({ granted: 2, spent: 0, message: 'E20.Lost' });
    await expiring.onPoolDropped(1);
    expect(combatFlags.expiringStoryPoints.spent).toBe(1);
    expect(await expiring.settleCombat(combat)).toBe(1);
    expect(storyPoints.setStoryPoints).toHaveBeenCalledWith(4);
    expect(ChatMessage.create).toHaveBeenCalledWith({ content: 'E20.Lost {"count":1}' });
  });

  test('another combat\'s mark, a non-GM client and a ledger with nothing granted do nothing; the forfeit never exceeds the pool', async () => {
    const combatFlags = {};
    global.game.combat = { id: 'c2', getFlag: (scope, key) => combatFlags[key], setFlag: jest.fn(async (scope, key, value) => {
      combatFlags[key] = value;
    }) };
    await expiring.onGrantMarked(actorWith(), { flags: { essence20: { expiringStoryPointsGrant: { combatId: 'c1', count: 1 } } } });
    await expiring.onPoolDropped(3);
    expect(combatFlags.expiringStoryPoints).toBeUndefined();
    global.game.users.activeGM = { isSelf: false };
    await expiring.onGrantMarked(actorWith(), { flags: { essence20: { expiringStoryPointsGrant: { combatId: 'c2', count: 1 } } } });
    expect(combatFlags.expiringStoryPoints).toBeUndefined();
    expect(expiring.expiringForfeit({ granted: 3, spent: 0 }, 1)).toBe(1);
    expect(expiring.expiringForfeit({ granted: 2, spent: 3 }, 5)).toBe(0);
  });

  test('a player\'s actor it can\'t write goes through the GM relay', async () => {
    global.game.combat = { id: 'c3' };
    relay.needsGmRelay.mockReturnValue(true);
    const actor = actorWith();
    await runSteps([{ do: 'storyPointsExpire' }], stepContext({ actor }));
    expect(relay.relayToGm).toHaveBeenCalledWith(actor, 'setFlag', ['essence20', 'expiringStoryPointsGrant', expect.objectContaining({ combatId: 'c3', count: 1 })]);
  });
});

describe('SummonArrival', () => {
  test("its values ride on the Zord's summon-timer write only", () => {
    expect(validateRule({ type: 'SummonArrival', set: { 'foo.bar': 1 } })).toEqual(['set needs system. / flags. paths']);
    const zord = actorWith([{ type: 'SummonArrival', set: { 'flags.essence20.form': true } }], { type: 'zord' });
    const write = { flags: { essence20: { zordSummonReadyRound: 3 } } };
    applySummonArrival(zord, write);
    expect(write.flags.essence20.form).toBe(true);
    const flat = { 'flags.essence20.zordSummonReadyRound': 2 };
    applySummonArrival(zord, flat);
    expect(flat.flags.essence20.form).toBe(true);
    const other = { name: 'x' };
    applySummonArrival(zord, other);
    expect(other.flags).toBeUndefined();
    const cleared = { flags: { essence20: { zordSummonReadyRound: null } } };
    applySummonArrival(zord, cleared);
    expect(cleared.flags.essence20.form).toBeUndefined();
  });
});

describe('buildSorcerousPower', () => {
  test('runs the builder; its line goes to chat; a cancel stops the run', async () => {
    const actor = actorWith([{ type: 'Use', steps: [] }]);
    const ctx = stepContext({ actor, item: ruleItem(actor) });
    expect(await runSteps([{ do: 'buildSorcerousPower' }, { do: 'chat', text: 'after' }], ctx)).toBe(false);
    expect(builder.buildSorcerousPower).toHaveBeenCalledWith(actor);
    builder.buildSorcerousPower.mockResolvedValue('Built it');
    const ok = stepContext({ actor, item: ruleItem(actor) });
    await runSteps([{ do: 'buildSorcerousPower' }], ok);
    expect(ok.chat).toEqual(['Built it']);
  });
});
