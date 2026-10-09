import { jest } from '@jest/globals';

/**
 * Round 16, part a (docs/rules-batches/slLeftA16.md): the engine pieces - FlatD20, DialogSwitch action / baseDamageMultiply /
 * backfireOn, RollModifier key / consumeOwn, Trigger oncePerRoll and @var.row, sizeChange, targetRowsBeating, AttackResistance,
 * bankReroll / rerollLimit, keyedCount, the Megaform contributions, the marked noArmor Defense with card:flag / cardTarget,
 * rule:choiceHas, {combat.id}, markText $var, spendActions atomic and the skills pick's essences.
 */

global.Hooks = { on: jest.fn(), once: () => 0, callAll: () => {} };
const epochs = { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1 };
global.game = { settings: { get: (scope, key) => epochs[key] }, combat: null, combats: null, i18n: null, user: { id: 'u1', targets: new Set() }, users: { activeGM: { isSelf: true } }, actors: [], scenes: [] };
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };

const spent = [];
const refunded = [];
let blockAt = Infinity;
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  spend: jest.fn(async (actor, action, options) => {
    if (spent.length >= blockAt) {
      return { ok: false, blocked: true };
    }

    spent.push({ name: actor?.name, action, ...(options?.context ? { kind: options.context.kind } : {}), source: options?.source ?? null });
    return { ok: true, blocked: false, spendId: `s${spent.length}` };
  }),
  refund: jest.fn(async (actor, spendId) => refunded.push(spendId)),
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const rerollUses = {};
jest.unstable_mockModule('./mechanics/rolls/reroll.mjs', () => ({
  canUseReroll: jest.fn(async (actor, config, key) => (rerollUses[key] ?? 0) < config.maxUses),
  consumeRerollUsage: jest.fn(async (actor, config, key) => {
    rerollUses[key] = (rerollUses[key] ?? 0) + 1;
  }),
  findRolePointsItem: () => null,
  applyReroll: jest.fn(),
}));
const defenses = new Map();
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  getDefenseValue: jest.fn((actor, defense) => defenses.get(actor)?.[defense] ?? 0),
  applyDamage: jest.fn(),
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

const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
global.foundry = { data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: { setProperty: setPath, getProperty: getPath, deepClone: v => JSON.parse(JSON.stringify(v)) } };

const { rebuildIndex, ruleId } = await import('./index.mjs');
await import('./plugins/index.mjs');

function makeItem(data) {
  const item = { id: `i${nextId++}`, effects: [], flags: { essence20: {} }, system: {}, ...data };
  item.uuid = `Item.${item.id}`;
  item.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(item, key, value);
    }

    if (item.parent) {
      rebuildIndex(item.parent);
    }
  });
  return item;
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(),
    system: { size: 'common', skills: {}, health: { value: 10, max: 10 }, energon: { normal: { value: 0 } }, powers: { personal: { value: 3, max: 5 } }, ...(extra.system ?? {}) },
    items: { contents: list, get: id => list.find(i => i.id == id), find: fn => list.find(fn), some: fn => list.some(fn), filter: fn => list.filter(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => [],
    getFlag: (scope, key) => getPath(actor.flags[scope], key),
    setFlag: jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value)),
    unsetFlag: jest.fn(async (scope, key) => setPath(actor, `flags.${scope}.-=${key}`, null)),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(actor, key, value);
    }

    rebuildIndex(actor);
  });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  byUuid.set(actor.uuid, actor);
  rebuildIndex(actor);
  return actor;
}

const withRules = (rules, data = {}) => makeItem({ name: data.name ?? 'Perk', type: data.type ?? 'perk', system: { rules, ...(data.system ?? {}) }, ...(data.flags ? { flags: data.flags } : {}) });

const { runSteps, stepContext, pickOptions } = await import('./steps.mjs');
const { evaluateTag, contextFor } = await import('./predicate.mjs');
const { validateRule } = await import('./types.mjs');
const { fireTriggers } = await import('./triggers.mjs');
const { ruleRollSources } = await import('./adapter.mjs');

beforeEach(() => {
  spent.length = 0;
  refunded.length = 0;
  blockAt = Infinity;
  game.combat = null;
  game.combats = null;
  epochs.sceneClockScene = 1;
  epochs.sceneClockEncounter = 1;
});

/* -------------------------------------------- */
/*  FlatD20                                      */
/* -------------------------------------------- */

describe('FlatD20', () => {
  let flat;
  beforeAll(async () => {
    flat = await import('./plugins/rolls/flat-d20.mjs');
  });

  const box = (extra = {}) => ({ type: 'FlatD20', key: 'dep', label: 'Flat', value: 10, limit: { per: 'scene', max: 1 }, both: { label: 'Both', uses: 2 }, ...extra });

  test('validates; a box needs a value, a change needs of', () => {
    expect(validateRule(box())).toEqual([]);
    expect(validateRule({ type: 'FlatD20', of: 'dep', addUses: 1 })).toEqual([]);
    expect(validateRule({ type: 'FlatD20', key: 'x' })).toContain('a FlatD20 box needs value');
    expect(validateRule({ type: 'FlatD20', value: 10 })).toContain('a FlatD20 needs key (its own box) or of (the box it changes)');
  });

  test('a box is offered while a use is left; both only with enough uses (addUses widens them)', () => {
    const item = withRules([box()]);
    const actor = makeActor([item]);
    expect(flat.flatD20Toggles(actor, {}).map(t => t.name)).toEqual([`${ruleId(item, 0)}-flat`]);
    expect(flat.flatD20Toggles(actor, { dataset: { isInitiative: true } })).toEqual([]);
    const wider = makeActor([withRules([box()]), withRules([{ type: 'FlatD20', of: 'dep', addUses: 1 }])]);
    expect(flat.flatD20Toggles(wider, {}).map(t => t.label)).toEqual(['Flat', 'Both']);
  });

  test('ticked: the value, the use counted; both needs Edge xor Snag and takes two uses', async () => {
    const item = withRules([box({ limit: { per: 'scene', max: 2 } })]);
    const actor = makeActor([item]);
    const name = ruleId(item, 0);
    expect(await flat.ruleFlatD20(actor, { ext: {} })).toEqual({ value: 0, both: false });
    expect(await flat.ruleFlatD20(actor, { ext: { [`${name}-flat`]: true, [`${name}-both`]: true }, edge: true, snag: true })).toEqual({ value: 10, both: false });
    expect(flat.flatD20Toggles(actor, {}).map(t => t.label)).toEqual(['Flat']);
    expect(await flat.ruleFlatD20(actor, { ext: { [`${name}-flat`]: true } })).toEqual({ value: 10, both: false });
    expect(flat.flatD20Toggles(actor, {})).toEqual([]);
  });

  test('lateWhen (its own or a change\'s) is asked after the dialog: failing, nothing is spent and the next box is tried', async () => {
    const first = withRules([box({ priority: 1 })]);
    const hangUp = withRules([{ type: 'FlatD20', of: 'dep', lateWhen: ['roll:edge'] }]);
    const second = withRules([{ type: 'FlatD20', key: 'or', priority: 2, label: 'Paid', value: 10, cost: { resource: { path: 'system.health.value' }, amount: 1 }, both: { label: 'Both', cost: 1 } }]);
    const actor = makeActor([second, hangUp, first]);
    const ext = { [`${ruleId(first, 0)}-flat`]: true, [`${ruleId(second, 0)}-flat`]: true, [`${ruleId(second, 0)}-both`]: true };
    expect(await flat.ruleFlatD20(actor, { ext, snag: true })).toEqual({ value: 10, both: true });
    expect(actor.system.health.value).toBe(8);
    expect(flat.flatD20Toggles(actor, {}).map(t => t.label)).toEqual(['Flat', 'Paid (1)', 'Both (+1)']);
    // With an Edge the first box applies (once per scene); then it is used up and the paid one is next again.
    expect(await flat.ruleFlatD20(actor, { ext, edge: true })).toEqual({ value: 10, both: false });
    expect(actor.system.health.value).toBe(8);
    expect(await flat.ruleFlatD20(actor, { ext, edge: true })).toEqual({ value: 10, both: true });
    expect(actor.system.health.value).toBe(6);
  });

  test('an upgrade box: its value instead, its cost added, its own limit; unaffordable - the box does nothing', async () => {
    const paid = withRules([{ type: 'FlatD20', key: 'or', label: 'Paid', value: 10, cost: { resource: { path: 'system.health.value' }, amount: 1 } }]);
    const up = withRules([{ type: 'FlatD20', of: 'or', upgrade: { label: 'Fifteen', value: 15, cost: 1, limit: { per: 'scene' } } }]);
    const actor = makeActor([paid, up], { system: { health: { value: 2 } } });
    const ext = { [`${ruleId(paid, 0)}-flat`]: true, [`${ruleId(up, 0)}-up`]: true };
    expect(flat.flatD20Toggles(actor, {}).map(t => t.label)).toEqual(['Paid (1)', 'Fifteen (+1)']);
    expect(await flat.ruleFlatD20(actor, { ext })).toEqual({ value: 15, both: false });
    expect(actor.system.health.value).toBe(0);
    expect(await flat.ruleFlatD20(actor, { ext })).toEqual({ value: 0, both: false });
  });
});

/* -------------------------------------------- */
/*  DialogSwitch action / multiplier / backfire  */
/* -------------------------------------------- */

describe('DialogSwitch action, baseDamageMultiply, backfireOn', () => {
  let actions;
  beforeAll(async () => {
    actions = await import('./plugins/dialog/switch-action-cost.mjs');
  });

  test('validates without a shift', () => {
    expect(validateRule({ type: 'DialogSwitch', action: 'free' })).toEqual([]);
    expect(validateRule({ type: 'DialogSwitch', baseDamageMultiply: 2 })).toEqual([]);
    expect(validateRule({ type: 'DialogSwitch', edge: true, actionKind: 'x' })).toContain('actionKind goes with action');
  });

  test('a ticked switch spends its action (with its kind); one that can\'t be paid says so', async () => {
    const item = withRules([{ type: 'DialogSwitch', label: 'Go', action: 'standard', actionKind: 'analyzeTarget', baseDamageMultiply: 2, backfireOn: 1 }], { name: 'Analyze' });
    const actor = makeActor([item]);
    const options = { ext: { [ruleId(item, 0)]: true } };
    expect(await actions.applySwitchActions(actor, options, {})).toBe(true);
    expect(spent).toEqual([{ name: 'Hero', action: 'standard', kind: 'analyzeTarget', source: 'Analyze' }]);
    expect(options).toEqual(expect.objectContaining({ ruleBaseDamageMultiplier: 2, ruleBackfireOn: [1] }));
    blockAt = 0;
    expect(await actions.applySwitchActions(actor, { ext: { [ruleId(item, 0)]: true } }, {})).toBe(false);
    expect(await actions.applySwitchActions(actor, { ext: {} }, {})).toBe(true);
  });

  test('backfires: any d20 showing the number', () => {
    const roll = { dice: [{ faces: 20, values: [7, 1] }, { faces: 6, values: [1] }] };
    expect(actions.backfires(roll, [1])).toBe(true);
    expect(actions.backfires(roll, [2])).toBe(false);
    expect(actions.backfires(roll, [])).toBe(false);
  });
});

/* -------------------------------------------- */
/*  RollModifier key / consumeOwn, oncePerRoll   */
/* -------------------------------------------- */

describe('RollModifier key and consumeOwn; Trigger oncePerRoll and @var.row', () => {
  test('a listed modifier carries its key; consumeOwn uses up only the holder\'s own copy', async () => {
    const { sourceKeys, consumeOwnMark } = await import('./plugins/rolls/once-per-roll.mjs');
    const actor = makeActor([withRules([{ type: 'RollModifier', label: 'G', key: 'g', upshift: 1, consumeMark: 'g', consumeFrom: 'target', consumeOwn: true }])], { id: 'me' });
    const target = makeActor([], { flags: { ruleMarks: { 'g--me': { by: actor.uuid }, 'g--other': { by: 'Actor.other' } } } });
    const { sources, consumes } = ruleRollSources(actor, target, {});
    expect(sourceKeys(sources)).toEqual(['g']);
    expect(consumes).toEqual([expect.objectContaining({ ext: 'rulesMarkOwn', actorUuid: target.uuid, key: 'g', setterId: 'me' })]);
    await consumeOwnMark(consumes[0]);
    expect(Object.keys(target.flags.essence20.ruleMarks)).toEqual(['g--other']);
  });

  test('oncePerRoll: the first hit that meets it, then not again in the same roll; @var.row reaches when', async () => {
    const actor = makeActor([withRules([
      { type: 'Trigger', event: 'hit', oncePerRoll: true, steps: [{ do: 'setVar', key: 'x', value: 1 }, { do: 'mark', key: 'once', to: 'target' }] },
      { type: 'Trigger', event: 'hit', when: ['var:row=0'], steps: [{ do: 'mark', key: 'first', to: 'target' }] },
    ])]);
    const [a, b] = [makeActor(), makeActor()];
    const once = new Set();
    await fireTriggers(actor, 'hit', { outcome: 'success', targets: [a], facts: { results: [{ success: true }] }, vars: { row: 0 }, once });
    await fireTriggers(actor, 'hit', { outcome: 'success', targets: [b], facts: { results: [{ success: true }] }, vars: { row: 1 }, once });
    expect(Object.keys(a.flags.essence20.ruleMarks ?? {}).sort()).toEqual(['first', 'once']);
    expect(Object.keys(b.flags.essence20.ruleMarks ?? {})).toEqual([]);
    expect(validateRule({ type: 'Trigger', event: 'afterRoll', oncePerRoll: true, steps: [{ do: 'chat', text: 'x' }] })).toContain('oncePerRoll only goes with a hit Trigger');
  });
});

/* -------------------------------------------- */
/*  sizeChange                                   */
/* -------------------------------------------- */

describe('sizeChange and self:sizeChanged', () => {
  let size;
  beforeAll(async () => {
    size = await import('./plugins/effects/timed-size.mjs');
  });

  const run = (actor, step) => runSteps([step], stepContext({ actor, item: actor.items.contents[0] ?? null, rule: {} }));

  test('steps or set; the size before kept; a live change is left alone; the tag', async () => {
    const actor = makeActor([withRules([])]);
    await run(actor, { do: 'sizeChange', key: 's', steps: 1, until: 'scene' });
    expect(actor.system.size).toBe('large');
    expect(actor.flags.essence20.ruleSizeChanges.s).toEqual(expect.objectContaining({ original: 'common', until: 'scene' }));
    await run(actor, { do: 'sizeChange', key: 's', set: 'huge', until: 'scene' });
    expect(actor.system.size).toBe('large');
    expect(evaluateTag('self:sizeChanged:s', contextFor({ self: actor }))).toBe(true);
    epochs.sceneClockScene = 2;
    expect(evaluateTag('self:sizeChanged:s', contextFor({ self: actor }))).toBe(false);
    // Run out but not put back yet: put back first, then the new change.
    await run(actor, { do: 'sizeChange', key: 's', set: 'huge', until: 'scene' });
    expect(actor.system.size).toBe('huge');
    expect(actor.flags.essence20.ruleSizeChanges.s.original).toBe('common');
  });

  test('rounds: N rounds of the combat, ending with it; out of combat the encounter', async () => {
    const actor = makeActor([withRules([])]);
    game.combat = { id: 'c1', round: 2, turn: 1 };
    game.combats = { get: id => (id == 'c1' ? game.combat : null) };
    await run(actor, { do: 'sizeChange', key: 'r', steps: 1, rounds: 10 });
    expect(actor.flags.essence20.ruleSizeChanges.r.rounds).toEqual({ epoch: 1, combatId: 'c1', untilRound: 12, untilTurn: 1 });
    expect(size.sizeChangeLive(actor, 'r')).toBe(true);
    game.combat.round = 12;
    expect(size.sizeChangeLive(actor, 'r')).toBe(false);
    game.combat.round = 3;
    await size.expireSizeChanges([actor], 'c1');
    expect(actor.system.size).toBe('common');
    expect(actor.flags.essence20.ruleSizeChanges.r).toBeUndefined();
    game.combat = null;
    await run(actor, { do: 'sizeChange', key: 'r', steps: 1, rounds: 10 });
    expect(size.sizeChangeLive(actor, 'r')).toBe(true);
    epochs.sceneClockEncounter = 2;
    await size.expireSizeChanges([actor]);
    expect(actor.system.size).toBe('common');
  });
});

/* -------------------------------------------- */
/*  targetRowsBeating, AttackResistance          */
/* -------------------------------------------- */

describe('targetRowsBeating and AttackResistance', () => {
  test('the creatures whose Defense the total also meets; a miss on a miss-immune one is left out', async () => {
    const actor = makeActor();
    const [low, high, immune] = [makeActor(), makeActor(), makeActor([withRules([{ type: 'MissImmunity' }])])];
    defenses.set(low, { toughness: 12 }).set(high, { toughness: 20 }).set(immune, { toughness: 10 });
    const ctx = stepContext({ actor, item: null, rule: {}, targets: [] });
    ctx.facts = { results: [{ targetUuid: low.uuid, total: 14, success: true }, { targetUuid: high.uuid, total: 14, success: true }, { targetUuid: immune.uuid, total: 14, success: false }, { total: 14 }], entries: [{}, {}, { defenseType: 'evasion' }, {}] };
    expect(await runSteps([{ do: 'targetRowsBeating', defense: 'toughness' }], ctx)).toBe(true);
    expect(ctx.targets).toEqual([low]);
    ctx.facts.results = [{ targetUuid: high.uuid, total: 14, success: true }];
    expect(await runSteps([{ do: 'targetRowsBeating', defense: 'toughness' }], ctx)).toBe(false);
  });

  test('AttackResistance: those types, while `when` holds', async () => {
    const { ruleResistsAttack } = await import('./plugins/combat/attack-resistance.mjs');
    const shield = withRules([{ type: 'AttackResistance', damageTypes: ['fire'], when: ['rule:data:system.active'] }], { type: 'shield', system: { equipped: true, active: false } });
    const actor = makeActor([shield]);
    expect(ruleResistsAttack(actor, 'fire')).toBe(false);
    shield.system.active = true;
    expect(ruleResistsAttack(actor, 'fire')).toBe(true);
    expect(ruleResistsAttack(actor, 'blunt')).toBe(false);
  });
});

/* -------------------------------------------- */
/*  bankReroll, rerollLimit, keyedCount          */
/* -------------------------------------------- */

describe('bankReroll, rerollLimit and keyedCount', () => {
  test('bankReroll 1..N; rerollLimit checks and spends the item\'s own reroll count', async () => {
    const item = withRules([], { system: { advances: { currentValue: 2 } } });
    const actor = makeActor([item]);
    const ctx = stepContext({ actor, item, rule: {} });
    expect(await runSteps([{ do: 'rerollLimit' }, { do: 'bankReroll', upTo: '@item.system.advances.currentValue' }, { do: 'rerollLimit', spend: true }], ctx)).toBe(true);
    expect(actor.flags.essence20.bankedReroll).toEqual({ values: [1, 2], source: 'Perk' });
    expect(rerollUses[`item:${item.uuid}`]).toBe(1);
    expect(await runSteps([{ do: 'rerollLimit' }], stepContext({ actor, item, rule: {} }))).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test('keyedCount: one more per creature, dots as dashes', async () => {
    const actor = makeActor();
    const other = makeActor();
    const ctx = stepContext({ actor, item: null, rule: {}, targets: [other] });
    await runSteps([{ do: 'keyedCount', flag: 'counts' }, { do: 'keyedCount', flag: 'counts' }], ctx);
    expect(actor.flags.essence20.counts).toEqual({ [other.uuid.replace(/\./g, '-')]: 2 });
  });
});

/* -------------------------------------------- */
/*  Megaform contributions                       */
/* -------------------------------------------- */

describe('Megaform contributions', () => {
  test('MegaformArmor by form, traitReplaced, MegaformHold, MegaformSpecializations, EnergonDonor', async () => {
    const mega = await import('./plugins/zords/megaform-contributions.mjs');
    const trait = withRules([{ type: 'MegaformArmor', toughness: '@item.system.value', replacesTrait: true }], { type: 'megaformTrait', system: { type: 'coreDefenses', value: 2 } });
    const feature = withRules([{ type: 'MegaformArmor', toughness: 1, form: 'megazord' }], { type: 'feature' });
    const zord = makeActor([trait, feature], { type: 'zord' });
    expect(mega.megaformArmorOf(zord, 'megazord')).toEqual({ toughness: 3, evasion: 0 });
    expect(mega.megaformArmorOf(zord, 'combiner')).toEqual({ toughness: 2, evasion: 0 });
    expect(mega.traitReplaced(trait)).toBe(true);
    expect(mega.traitReplaced(feature)).toBe(false);
    const ace = makeActor([withRules([{ type: 'MegaformHold' }, { type: 'MegaformSpecializations' }, { type: 'EnergonDonor' }])], { system: { energon: { normal: { value: 1 } } } });
    expect(mega.holdsMegaformTogether(ace)).toBe(true);
    expect(mega.sharesSpecializations(ace)).toBe(true);
    expect(mega.holdsMegaformTogether(zord)).toBe(false);
    const form = makeActor([], { type: 'megaform', system: { actors: { a: { uuid: zord.uuid }, b: { uuid: ace.uuid } } } });
    expect(mega.energonDonor(form)).toBe(ace);
    await mega.payEnergonDonor(ace);
    expect(ace.system.energon.normal.value).toBe(0);
    expect(mega.energonDonor(form)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Marked noArmor, card:flag, cardTarget        */
/* -------------------------------------------- */

describe('Defense noArmor scope markedTarget, card:flag and cardTarget', () => {
  test('attacks on a creature carrying the setter\'s mark, when `when` holds; not through the setter\'s own noArmor reading', async () => {
    const { ruleMarkedNoArmor } = await import('./plugins/combat/marked-no-armor.mjs');
    const { ruleNoArmor } = await import('./plugins/combat/no-armor-defense.mjs');
    const rule = { type: 'Defense', mode: 'noArmor', outgoing: true, scope: 'markedTarget', mark: 'ew', defense: 'any', when: ['not:target:type:vehicle'] };
    expect(validateRule(rule)).toEqual([]);
    const setter = makeActor([withRules([rule])]);
    const mate = makeActor();
    const foe = makeActor([], { flags: { ruleMarks: { ew: { by: setter.uuid, until: null } } } });
    expect(ruleMarkedNoArmor(mate, foe, 'toughness')).toBe(true);
    expect(ruleMarkedNoArmor(mate, makeActor(), 'toughness')).toBe(false);
    expect(ruleNoArmor(setter, foe, 'toughness')).toBe(false);
  });

  test('card:flag and cardTarget', async () => {
    const target = makeActor();
    const card = { flags: { essence20: { isMelee: true, targetUuid: target.uuid, nothing: false } } };
    expect(evaluateTag('card:flag:isMelee', contextFor({ card }))).toBe(true);
    expect(evaluateTag('card:flag:nothing', contextFor({ card }))).toBe(false);
    expect(evaluateTag('card:flag:isMelee', contextFor({}))).toBe(null);
    const ctx = stepContext({ actor: makeActor(), item: null, rule: {} });
    ctx.offerMessage = card;
    await runSteps([{ do: 'mark', key: 'm', to: 'cardTarget' }], ctx);
    expect(target.flags.essence20.ruleMarks.m).toBeDefined();
  });
});

/* -------------------------------------------- */
/*  Small pieces                                 */
/* -------------------------------------------- */

describe('rule:choiceHas, {combat.id}, markText $var, spendActions atomic, skills essences', () => {
  test('rule:choiceHas reads a list or a value', () => {
    const item = makeItem({ flags: { essence20: { rules: { choices: { list: ['a', 'b'], one: 'c' } } } } });
    expect(evaluateTag('rule:choiceHas:list:b', contextFor({ ruleItem: item }))).toBe(true);
    expect(evaluateTag('rule:choiceHas:list:c', contextFor({ ruleItem: item }))).toBe(false);
    expect(evaluateTag('rule:choiceHas:one:c', contextFor({ ruleItem: item }))).toBe(true);
    expect(evaluateTag('rule:choiceHas:none:c', contextFor({ ruleItem: item }))).toBe(false);
  });

  test('a mark keeping {combat.id}, compared with $var.combatId', async () => {
    const actor = makeActor();
    game.combat = { id: 'c9' };
    await runSteps([{ do: 'mark', key: 'debt', to: 'self', text: '{combat.id}' }], stepContext({ actor, item: null, rule: {} }));
    expect(evaluateTag('self:markText:debt=$var.combatId', contextFor({ self: actor, vars: { combatId: 'c9' } }))).toBe(true);
    expect(evaluateTag('self:markText:debt=$var.combatId', contextFor({ self: actor, vars: { combatId: 'c1' } }))).toBe(false);
  });

  test('spendActions atomic gives back what it spent when one is blocked', async () => {
    game.combat = { id: 'c1' };
    blockAt = 1;
    const ctx = stepContext({ actor: makeActor(), item: null, rule: {} });
    expect(await runSteps([{ do: 'spendActions', action: 'free', count: 2, atomic: true }], ctx)).toBe(false);
    expect(refunded).toEqual(['s1']);
    refunded.length = 0;
    spent.length = 0;
    expect(await runSteps([{ do: 'spendActions', action: 'free', count: 2 }], ctx)).toBe(false);
    expect(refunded).toEqual([]);
  });

  test('pick from skills with essences', () => {
    global.CONFIG = { E20: { skillToEssence: { deception: 'social', culture: 'smarts', might: 'strength' }, skills: {} } };
    const actor = makeActor([], { system: { skills: { deception: { shift: 'd4' }, culture: { shift: 'd20' }, might: { shift: 'd6' } } } });
    const options = pickOptions({ from: 'skills', essences: ['smarts', 'social'], notShift: ['d20'] }, stepContext({ actor, item: null, rule: {} }));
    expect(options.map(o => o.value)).toEqual(['deception']);
  });
});
