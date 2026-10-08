import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 16, part a (docs/rules-batches/slLeftA16.md): the items rounds 14 and 15 left as code, on their own rules now.
 * Each is loaded from its pack source and must do what the removed code (and its old tests in dice.test.js, chat.test.js,
 * banked-buffs.test.js and items/*.test.js) did.
 */

global.Hooks = { on: jest.fn(), once: () => 0, callAll: () => {} };
const epochs = { sceneClockScene: 1, sceneClockEncounter: 1, sceneClockMission: 1 };
const chat = [];
global.ChatMessage = {
  create: jest.fn(async data => chat.push(data)),
  getSpeaker: ({ actor } = {}) => ({ actor: actor?.id ?? null }),
  getSpeakerActor: speaker => byId.get(speaker?.actor) ?? null,
};
global.ui = { notifications: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } };
global.game = {
  settings: { get: (scope, key) => epochs[key] }, combat: null, combats: null, i18n: null,
  user: { id: 'u1', isGM: true, targets: new Set() }, users: { activeGM: { isSelf: true }, contents: [] }, actors: [], scenes: [],
};

const spent = [];
const refunded = [];
let blockAt = Infinity;
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  spend: jest.fn(async (actor, action, options) => {
    if (spent.length >= blockAt) {
      return { ok: false, blocked: true };
    }

    spent.push({ name: actor?.name, action, ...(options?.context ? { kind: options.context.kind } : {}) });
    return { ok: true, blocked: false, spendId: `s${spent.length}` };
  }),
  refund: jest.fn(async (actor, spendId) => refunded.push(spendId)),
  grantBonusAttack: jest.fn(),
}));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
const conditions = [];
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status) => {
    conditions.push({ name: actor.name, status });
    actor.statuses.add(status);
  }),
}));
const defenses = new Map();
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  getDefenseValue: jest.fn((actor, defense) => defenses.get(actor)?.[defense] ?? 0),
  applyDamage: jest.fn(),
  computeMultiplier: (total, dif) => (!dif || total < dif ? 0 : Math.max(1, Math.floor(total / dif))),
}));
const pushed = [];
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({
  pushActor: jest.fn(async (target, from, feet) => pushed.push({ name: target.name, from: from?.name, feet })),
  distanceFeet: () => 0,
}));
const saves = [];
jest.unstable_mockModule('./mechanics/combat/save-riders.mjs', () => ({
  postSaveCard: jest.fn(async (actor, targets, spec) => saves.push({ by: actor.name, targets: targets.map(t => t.name), ...spec })),
  resolveSaveRoll: jest.fn(),
}));
let enemies = [];
jest.unstable_mockModule('./mechanics/combat/nearby-enemies.mjs', () => ({
  getNearbyEnemyTokens: jest.fn(() => enemies.map(actor => ({ actor }))),
}));
const rolls = [];
let rollResult = { success: false };
let picks = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  rollTest: jest.fn(async (actor, skill, dif, extra) => {
    rolls.push({ name: actor.name, skill, dif, ...extra });
    return rollResult;
  }),
  chooseSelect: jest.fn(async (title, prompt, options) => {
    const want = picks.shift();
    return options.find(option => option.value == want)?.value ?? null;
  }),
}));
const rerollUses = {};
jest.unstable_mockModule('./mechanics/rolls/reroll.mjs', () => ({
  canUseReroll: jest.fn(async (actor, config, key) => (rerollUses[key] ?? 0) < config.maxUses),
  consumeRerollUsage: jest.fn(async (actor, config, key) => {
    rerollUses[key] = (rerollUses[key] ?? 0) + 1;
  }),
  findRolePointsItem: () => null,
  applyReroll: jest.fn(),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  dependable: 'ghpfitems/_source/Dependable_TQaVcZQHYTmmTv6b.json',
  dependableHangUp: 'ghpfitems/_source/Dependable_mwELSYc9AGgImy7N.json',
  oldReliable: 'ghpfitems/_source/Old_Reliable_0TYq9zWlE0xX6KvT.json',
  legendary: 'ghpfitems/_source/Legendary_Dependability_Ouw89rVHYKgMnYMi.json',
  undoEngine: 'iafav2items/_source/Undo_Engine_0nTFK9GOpkQcjcHB.json',
  aftershock: 'gijcrbitems/_source/Explosive_Aftershock_Kvq0MfPqSya2mf5b.json',
  analyze: 'tfcrbitems/_source/Analyze_Target_UjzBPz4iUBoi8Kyk.json',
  scarefying: 'kocitems/_source/Scarefying_Appearance_110Rq0wQaqFuugUc.json',
  mug: 'kocitems/_source/Massive_Mug_of_Mammoth_Measurements_YMC3WoSkJ11jrwUn.json',
  shrink: 'kocitems/_source/Petite_Pony_s_Shrink_Drink_BrMqHsZVG2OOo21W.json',
  getAGrip: 'dditems/_source/Get_A_Grip_CkeKNYNaotNlxWxd.json',
  dispersion: 'ccitems/_source/Dispersion_WHJLWQRUiCqSqLrK.json',
  angry: 'ccitems/_source/Angry_fHmLPZ3K8AGgzANp.json',
  angryHangUp: 'ccitems/_source/Angry_wGMyGbySdNSgPs8B.json',
  growl: 'ccitems/_source/Growl_OSVtPXBdRmZ2C4PD.json',
  horns: 'ccitems/_source/Get_The_Horns_gi8vv2ujGBQNLjIq.json',
  armoredDefense: 'eocitems/_source/Armored_Defense_GQHo1Tv5jIJ65GW3.json',
  hardenedChassis: 'prcrbitems/_source/Hardened_Chassis_7vwrFKj2UAxG4ocf.json',
  keepItTogether: 'eocitems/_source/Keep_IT_Together__9QdGh6Kfb1EVi4N7.json',
  betterAsOne: 'eocitems/_source/Better_As_One_XnmVJF4XNcsaXAKL.json',
  surging: 'ccitems/_source/Surging_iDSVcsovl4V2uQmj.json',
  powerInfusion: 'prcrbitems/_source/Power_Infusion_cuBM706WJjAmhoZO.json',
  hardCorps: 'sssitems/_source/Hard_Corps_IR8Rl7IXn0zKBBXV.json',
  exploitWeakness: 'prcrbitems/_source/Exploit_Weakness_BTSdvgvfKHWeV07C.json',
};
const PACK = { dependableHangUp: 'general_hawk_s_personel_files', angryHangUp: 'cobra_codex' };

let nextId = 1;
const byUuid = new Map();
const byId = new Map();
global.fromUuidSync = uuid => byUuid.get(uuid) ?? null;
global.fromUuid = async uuid => byUuid.get(uuid) ?? null;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
  if (last.startsWith('-=')) {
    delete parent[last.slice(2)];
  } else {
    parent[last] = value;
  }
}

const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
global.foundry = {
  utils: { setProperty: setPath, getProperty: getPath, deepClone: v => JSON.parse(JSON.stringify(v)), randomID: () => `r${nextId++}` },
  applications: { api: { DialogV2: { wait: jest.fn(async () => null), confirm: jest.fn(async () => true) } } },
};
global.CONFIG = {
  E20: {
    skillToEssence: { deception: 'social', culture: 'smarts', persuasion: 'social', might: 'strength', athletics: 'strength', intimidation: 'strength', alertness: 'smarts', driving: 'speed' },
    skills: {}, actorSizes: { small: 's', common: 'c', large: 'l', long: 'lo', huge: 'h', extended: 'e', gigantic: 'g' },
    skillShiftList: ['criticalSuccess', 'autoSuccess', '3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20', 'autoFail', 'fumble'],
  },
};

const { rebuildIndex, ruleId } = await import('./index.mjs');
await import('./plugins/index.mjs');

function makeItem(data) {
  const item = { id: `i${nextId++}`, effects: [], flags: {}, system: {}, ...data };
  item.flags.essence20 ??= {};
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

function packItem(key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) },
    flags: { core: { sourceId: `Compendium.essence20.${PACK[key] ?? 'x'}.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  });
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(extra.statuses ?? []),
    system: {
      level: 10, size: 'common', skills: { intimidation: { shift: 'd6' }, deception: { shift: 'd4' }, culture: { shift: 'd20' }, persuasion: { shift: 'd8' } },
      health: { max: 10, value: 10, bonus: 0 }, powers: { personal: { value: 3, max: 5 } }, energon: { normal: { value: 0 } }, resistances: {}, isMorphed: false,
      ...(extra.system ?? {}),
    },
    effects: [],
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => extra.tokens ?? [],
    toggleStatusEffect: jest.fn(async (status, { active } = {}) => (active === false ? actor.statuses.delete(status) : actor.statuses.add(status))),
    prototypeToken: { disposition: extra.disposition ?? 1 },
    _dice: { rollSkill: jest.fn(async () => ({ success: true, outcomes: [] })) },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => getPath(actor.flags[scope], key);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
  actor.unsetFlag = jest.fn(async (scope, key) => setPath(actor, `flags.${scope}.-=${key}`, null));
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
  byId.set(actor.id, actor);
  rebuildIndex(actor);
  return actor;
}

const attack = (actor, data = {}) => {
  const one = makeItem({ name: data.name ?? 'Attack', type: 'weaponEffect', flags: { essence20: { ...(data.parentId ? { parentId: data.parentId } : {}) } },
    system: { classification: { style: data.style ?? 'melee', skill: data.skill ?? 'might' }, damageType: data.damageType ?? 'blunt', damageValue: 2 } });
  one.parent = actor;
  actor.items.contents.push(one);
  rebuildIndex(actor);
  return one;
};

const { runUse, fireTriggers } = await import('./triggers.mjs');
const { applyRuleSwitches, ruleDialogSwitches, ruleRollSources } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { bankedEntries } = await import('./bank.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { flatD20Toggles, ruleFlatD20 } = await import('./plugins/rolls/flat-d20.mjs');
const { applySwitchActions } = await import('./plugins/dialog/switch-action-cost.mjs');
const { ruleResistsAttack } = await import('./plugins/combat/attack-resistance.mjs');
const { applyingDamageStage } = await import('./plugins/combat/applying-damage-stages.mjs');
const { offersFor, pressOffer } = await import('./plugins/cards/card-offer.mjs');
const { ruleMarkedNoArmor } = await import('./plugins/combat/marked-no-armor.mjs');
const { sizeChangeLive } = await import('./plugins/effects/timed-size.mjs');

const pay = jest.fn(async () => true);

beforeEach(() => {
  spent.length = 0;
  refunded.length = 0;
  blockAt = Infinity;
  conditions.length = 0;
  pushed.length = 0;
  saves.length = 0;
  rolls.length = 0;
  chat.length = 0;
  enemies = [];
  picks = [];
  rollResult = { success: false };
  game.combat = null;
  game.combats = null;
  game.user.targets = new Set();
  epochs.sceneClockScene = 1;
  epochs.sceneClockEncounter = 1;
});

const targetsOf = (...actors) => {
  const set = new Set(actors.map(actor => ({ actor })));
  set.first = () => [...set][0];
  return set;
};

test('the rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Dependable, Old Reliable, Legendary          */
/* -------------------------------------------- */

describe('Dependable / Old Reliable / Legendary Dependability', () => {
  const moxie = (value = 3) => makeItem({ name: 'Moxie', type: 'rolePoints', system: { resource: { value, max: 5 } } });
  const names = actor => flatD20Toggles(actor, {}).map(toggle => toggle.label);

  test('Dependable: once per scene, no both box; Legendary Dependability makes it twice, and both d20s for both uses', async () => {
    const dependable = packItem('dependable');
    const actor = makeActor([dependable]);
    expect(names(actor)).toEqual(['E20.RollDialogDependable']);
    const name = ruleId(dependable, 0);
    expect(await ruleFlatD20(actor, { ext: { [`${name}-flat`]: true }, edge: true })).toEqual({ value: 10, both: false });
    expect(names(actor)).toEqual([]);
    epochs.sceneClockScene = 2;
    const legendary = makeActor([packItem('dependable'), packItem('legendary')]);
    const box = ruleId(legendary.items.contents[0], 0);
    expect(names(legendary)).toEqual(['E20.RollDialogDependable', 'E20.RollDialogDependableBoth']);
    expect(await ruleFlatD20(legendary, { ext: { [`${box}-flat`]: true, [`${box}-both`]: true }, edge: true })).toEqual({ value: 10, both: true });
    expect(names(legendary)).toEqual([]);
  });

  test('Dependable\'s Hang-Up: only with an Edge - without one the box does nothing and costs nothing', async () => {
    const dependable = packItem('dependable');
    const actor = makeActor([dependable, packItem('dependableHangUp')]);
    const ext = { [`${ruleId(dependable, 0)}-flat`]: true };
    expect(await ruleFlatD20(actor, { ext })).toEqual({ value: 0, both: false });
    expect(names(actor)).toEqual(['E20.RollDialogDependable']);
    expect(await ruleFlatD20(actor, { ext, edge: true })).toEqual({ value: 10, both: false });
  });

  test('Old Reliable: 1 Moxie; both d20s 1 more with an Edge or a Snag; Legendary Dependability\'s 15 one more, once per scene', async () => {
    const old = packItem('oldReliable');
    const legendary = packItem('legendary');
    const points = moxie(4);
    const actor = makeActor([old, legendary, points]);
    expect(names(actor)).toEqual(['E20.RollDialogOldReliable (1 E20.OldHandMoxie)', 'E20.RollDialogOldReliableBoth (+1 E20.OldHandMoxie)', 'E20.RollDialogLegendaryDependability (+1 E20.OldHandMoxie)']);
    const ext = { [`${ruleId(old, 0)}-flat`]: true, [`${ruleId(old, 0)}-both`]: true, [`${ruleId(legendary, 1)}-up`]: true };
    expect(await ruleFlatD20(actor, { ext, snag: true })).toEqual({ value: 15, both: true });
    expect(points.system.resource.value).toBe(1);
    expect(names(actor)).toEqual(['E20.RollDialogOldReliable (1 E20.OldHandMoxie)']);
    // No Edge / Snag: the both box is ignored (and not paid).
    expect(await ruleFlatD20(actor, { ext })).toEqual({ value: 10, both: false });
    expect(points.system.resource.value).toBe(0);
    expect(await ruleFlatD20(actor, { ext })).toEqual({ value: 0, both: false });
  });

  test('Dependable goes first; an unaffordable Old Reliable combination does nothing at all', async () => {
    const dependable = packItem('dependable');
    const old = packItem('oldReliable');
    const legendary = packItem('legendary');
    const points = moxie(2);
    const actor = makeActor([old, legendary, dependable, points]);
    const ext = { [`${ruleId(dependable, 0)}-flat`]: true, [`${ruleId(old, 0)}-flat`]: true, [`${ruleId(old, 0)}-both`]: true, [`${ruleId(legendary, 1)}-up`]: true };
    expect(await ruleFlatD20(actor, { ext, edge: true })).toEqual({ value: 10, both: false });
    expect(points.system.resource.value).toBe(2);
    await ruleFlatD20(actor, { ext, edge: true });
    // Dependable is used up twice (Legendary Dependability); 1 + 1 + 1 Moxie is more than the 2 there are.
    expect(await ruleFlatD20(actor, { ext, edge: true })).toEqual({ value: 0, both: false });
    expect(points.system.resource.value).toBe(2);
  });
});

/* -------------------------------------------- */
/*  Undo Engine                                  */
/* -------------------------------------------- */

describe('Undo Engine', () => {
  test('a Critical Success (x2) on a vehicle: its driver rolls Driving DIF 20; a failure stalls it with a restart button', async () => {
    const driver = makeActor([], { name: 'Driver' });
    const vehicle = makeActor([], { name: 'Truck', type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    const actor = makeActor([packItem('undoEngine')]);
    const rolled = attack(actor);
    await fireTriggers(actor, 'hit', { roll: { item: rolled, isAttack: true }, outcome: 'success', targets: [vehicle], facts: { results: [{ success: true, multiplier: 1 }] } });
    expect(rolls).toEqual([]);
    await fireTriggers(actor, 'hit', { roll: { item: rolled, isAttack: true }, outcome: 'double', targets: [vehicle], facts: { results: [{ success: true, multiplier: 2 }] } });
    expect(rolls).toEqual([expect.objectContaining({ name: 'Driver', skill: 'driving', dif: 20 })]);
    expect(vehicle.flags.essence20.undoEngineMovementDisabled).toBe(true);
    const card = chat.find(message => message.flags?.essence20?.ruleButton);
    expect(card.flags.essence20.ruleButton).toEqual(expect.objectContaining({ who: 'anyone', targets: [vehicle.uuid] }));
    // Pressed: the driver spends the Standard action (in combat) and the engines restart.
    game.combat = { id: 'c1' };
    await runSteps(card.flags.essence20.ruleButton.steps, stepContext({ actor: driver, item: null, rule: {}, targets: [vehicle] }));
    expect(spent).toEqual([{ name: 'Driver', action: 'standard' }]);
    expect(vehicle.flags.essence20.undoEngineMovementDisabled).toBe(false);
  });

  test('a success on the Driving Test, or a target that isn\'t a vehicle, does nothing', async () => {
    const driver = makeActor([], { name: 'Driver' });
    const vehicle = makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    const actor = makeActor([packItem('undoEngine')]);
    const rolled = attack(actor);
    rollResult = { success: true };
    await fireTriggers(actor, 'hit', { roll: { item: rolled, isAttack: true }, outcome: 'double', targets: [vehicle], facts: { results: [{ success: true, multiplier: 2 }] } });
    expect(vehicle.flags.essence20.undoEngineMovementDisabled).toBeUndefined();
    rolls.length = 0;
    await fireTriggers(actor, 'hit', { roll: { item: rolled, isAttack: true }, outcome: 'double', targets: [makeActor()], facts: { results: [{ success: true, multiplier: 2 }] } });
    expect(rolls).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Explosive Aftershock                         */
/* -------------------------------------------- */

describe('Explosive Aftershock', () => {
  test('an explosive attack: the creatures whose Toughness the total meets get the two effects picked once', async () => {
    const actor = makeActor([packItem('aftershock')], { name: 'Gunner' });
    const rolled = attack(actor, { style: 'explosive', skill: 'targeting' });
    const [soft, hard] = [makeActor([], { name: 'Soft' }), makeActor([], { name: 'Hard' })];
    defenses.set(soft, { toughness: 12 }).set(hard, { toughness: 18 });
    picks = ['prone,penalty'];
    await fireTriggers(actor, 'afterRoll', {
      roll: { item: rolled, isAttack: true }, outcome: 'success',
      facts: { results: [{ targetUuid: soft.uuid, total: 14, success: true }, { targetUuid: hard.uuid, total: 14, success: true }], entries: [] },
    });
    expect(conditions).toEqual([{ name: 'Soft', status: 'prone' }]);
    expect(pushed).toEqual([]);
    expect(bankedEntries(soft)).toEqual([expect.objectContaining({ shiftDown: 1, until: 'combat', label: 'Explosive Aftershock' })]);
    expect(bankedEntries(hard)).toEqual([]);
    picks = ['deafened,push'];
    await fireTriggers(actor, 'afterRoll', { roll: { item: rolled, isAttack: true }, outcome: 'failure', facts: { results: [{ targetUuid: soft.uuid, total: 12, success: false }], entries: [] } });
    expect(conditions).toEqual([{ name: 'Soft', status: 'prone' }, { name: 'Soft', status: 'deafened' }]);
    expect(pushed).toEqual([{ name: 'Soft', from: 'Gunner', feet: 10 }]);
  });

  test('not on a non-explosive attack; no creature beaten - no picker', async () => {
    const actor = makeActor([packItem('aftershock')]);
    const soft = makeActor();
    defenses.set(soft, { toughness: 12 });
    picks = ['prone,deafened'];
    await fireTriggers(actor, 'afterRoll', { roll: { item: attack(actor), isAttack: true }, outcome: 'success', facts: { results: [{ targetUuid: soft.uuid, total: 20, success: true }], entries: [] } });
    await fireTriggers(actor, 'afterRoll', { roll: { item: attack(actor, { style: 'explosive' }), isAttack: true }, outcome: 'success', facts: { results: [{ targetUuid: soft.uuid, total: 5, success: true }], entries: [] } });
    expect(conditions).toEqual([]);
    expect(picks).toEqual(['prone,deafened']);
  });
});

/* -------------------------------------------- */
/*  Analyze Target                               */
/* -------------------------------------------- */

describe('Analyze Target', () => {
  test('offered on Alertness; ticked it spends the Standard action (kind analyzeTarget) and a hit counts the target', async () => {
    const perk = packItem('analyze');
    const actor = makeActor([perk]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'culture' })).toEqual([]);
    const [toggle] = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });
    expect(toggle).toEqual(expect.objectContaining({ name: ruleId(perk, 0), value: false }));
    const options = { ext: { [ruleId(perk, 0)]: true } };
    expect(await applySwitchActions(actor, options, { rolledSkill: 'alertness' })).toBe(true);
    expect(spent).toEqual([{ name: 'Hero', action: 'standard', kind: 'analyzeTarget' }]);
    await applyRuleSwitches(actor, options, { rolledSkill: 'alertness' });
    expect(options.ruleKeys).toEqual(['analyzeTarget']);
    const target = makeActor();
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'alertness', switches: options.ruleKeys }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'alertness', switches: options.ruleKeys }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'alertness', switches: [] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    expect(actor.flags.essence20.analyzeTargetCounts).toEqual({ [target.uuid.replace(/\./g, '-')]: 2 });
    blockAt = 0;
    expect(await applySwitchActions(actor, { ext: { [ruleId(perk, 0)]: true } }, { rolledSkill: 'alertness' })).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Scarefying Appearance and the potions        */
/* -------------------------------------------- */

describe('Scarefying Appearance', () => {
  test('a successful cast: one size up for 10 rounds, a save for the same-size-or-smaller threats, two benefits picked', async () => {
    const spell = packItem('scarefying');
    const actor = makeActor([spell], { name: 'Pony' });
    const [small, big] = [makeActor([], { name: 'Small', system: { size: 'small' } }), makeActor([], { name: 'Big', system: { size: 'huge' } })];
    enemies = [small, big];
    foundry.applications.api.DialogV2.wait.mockResolvedValueOnce(['might', 'toughness']);
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'failure', facts: { results: [{ success: false }] } });
    expect(actor.system.size).toBe('common');
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(actor.system.size).toBe('large');
    expect(saves).toEqual([expect.objectContaining({ by: 'Pony', targets: ['Small'], skills: ['intimidation'], dif: 14, status: 'frightened' })]);
    expect(spell.flags.essence20.rules.choices.benefits).toEqual(['might', 'toughness']);
    const labels = skill => ruleRollSources(actor, null, { rolledSkill: skill }).sources.map(source => [source.label, source.shiftUp]);
    expect(labels('intimidation')).toEqual([['Scarefying Appearance', 2]]);
    expect(labels('might')).toEqual([['Scarefying Appearance (Might)', 1]]);
  });

  test('a recast while it lasts leaves the size alone; it ends after 10 rounds', async () => {
    const spell = packItem('scarefying');
    const actor = makeActor([spell]);
    game.combat = { id: 'c1', round: 1, turn: 0 };
    game.combats = { get: id => (id == 'c1' ? game.combat : null) };
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: { results: [{ success: true }] } });
    await fireTriggers(actor, 'afterRoll', { roll: { item: spell }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(actor.system.size).toBe('large');
    expect(sizeChangeLive(actor, 'scarefying')).toBe(true);
    game.combat.round = 11;
    expect(sizeChangeLive(actor, 'scarefying')).toBe(false);
    expect(ruleRollSources(actor, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  });
});

describe('Massive Mug of Mammoth Measurements / Petite Pony\'s Shrink Drink', () => {
  test('Huge (or Small) for the scene; one at a time; an old one from an earlier scene is put back first', async () => {
    const mug = packItem('mug');
    const shrink = packItem('shrink');
    const actor = makeActor([mug, shrink]);
    await fireTriggers(actor, 'afterRoll', { roll: { item: mug }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(actor.system.size).toBe('huge');
    await fireTriggers(actor, 'afterRoll', { roll: { item: shrink }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(actor.system.size).toBe('huge');
    epochs.sceneClockScene = 2;
    await fireTriggers(actor, 'afterRoll', { roll: { item: shrink }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(actor.system.size).toBe('small');
    expect(actor.flags.essence20.ruleSizeChanges.sizePotion.original).toBe('common');
  });
});

/* -------------------------------------------- */
/*  Get A Grip                                   */
/* -------------------------------------------- */

describe('Get A Grip', () => {
  test('offered on an unarmed attack; on a hit two Free actions Grapple the first target no more than one size larger', async () => {
    const perk = packItem('getAGrip');
    const actor = makeActor([perk]);
    const unarmed = attack(actor);
    expect(ruleDialogSwitches(actor, { item: attack(actor, { parentId: 'w1' }) })).toEqual([]);
    expect(ruleDialogSwitches(actor, { item: unarmed })).toEqual([expect.objectContaining({ name: ruleId(perk, 0) })]);
    game.combat = { id: 'c1' };
    const [huge, large, common] = [makeActor([], { name: 'Huge', system: { size: 'huge' } }), makeActor([], { name: 'Large', system: { size: 'large' } }), makeActor([], { name: 'Common' })];
    const once = new Set();
    for (const target of [huge, large, common]) {
      await fireTriggers(actor, 'hit', { roll: { item: unarmed, isAttack: true, switches: ['getAGrip'] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] }, once });
    }

    expect(conditions).toEqual([{ name: 'Large', status: 'grappled' }]);
    expect(spent).toEqual([{ name: 'Hero', action: 'free' }, { name: 'Hero', action: 'free' }]);
  });

  test('when the second Free action can\'t be paid the first is given back and nothing is Grappled - and no other target is tried', async () => {
    const actor = makeActor([packItem('getAGrip')]);
    const unarmed = attack(actor);
    game.combat = { id: 'c1' };
    blockAt = 1;
    const once = new Set();
    for (const target of [makeActor(), makeActor()]) {
      await fireTriggers(actor, 'hit', { roll: { item: unarmed, isAttack: true, switches: ['getAGrip'] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] }, once });
    }

    expect(conditions).toEqual([]);
    expect(refunded).toEqual(['s1']);
  });
});

/* -------------------------------------------- */
/*  Dispersion, Angry                            */
/* -------------------------------------------- */

describe('Dispersion', () => {
  test('energy Resistance for the attacker\'s Snag, only while equipped and raised', () => {
    const shield = packItem('dispersion', { system: { equipped: true, active: false } });
    const actor = makeActor([shield]);
    expect(ruleResistsAttack(actor, 'laser')).toBe(false);
    shield.system.active = true;
    expect(ruleResistsAttack(actor, 'laser')).toBe(true);
    expect(ruleResistsAttack(actor, 'element')).toBe(true);
    expect(ruleResistsAttack(actor, 'blunt')).toBe(false);
    shield.system.equipped = false;
    rebuildIndex(actor);
    expect(ruleResistsAttack(actor, 'laser')).toBe(false);
  });
});

describe('Angry and its Hang-Up', () => {
  test('Edge on a Strength test once per encounter; with the Hang-Up a trained Smarts or Social Skill is picked and Snagged for the scene', async () => {
    const perk = packItem('angry');
    const actor = makeActor([perk, packItem('angryHangUp')]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'deception', rolledEssence: 'social' })).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toHaveLength(1);
    picks = ['deception'];
    const options = { ext: { [ruleId(perk, 0)]: true } };
    await applyRuleSwitches(actor, options, { rolledSkill: 'might', rolledEssence: 'strength' });
    expect(options.edge).toBe(true);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'might', rolledEssence: 'strength' })).toEqual([]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([expect.objectContaining({ label: 'Angry', snag: true })]);
    expect(ruleRollSources(actor, null, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    epochs.sceneClockScene = 2;
    expect(ruleRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
  });

  test('without the Hang-Up (or with it Matured-ignored) nothing is picked', async () => {
    const perk = packItem('angry');
    const actor = makeActor([perk, packItem('angryHangUp', { flags: { maturedIgnored: true } })]);
    picks = ['deception'];
    await applyRuleSwitches(actor, { ext: { [ruleId(perk, 0)]: true } }, { rolledSkill: 'might', rolledEssence: 'strength' });
    expect(picks).toEqual(['deception']);
    expect(actor.flags.essence20.ruleMarks?.angrySnag).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Growl and Get The Horns                      */
/* -------------------------------------------- */

describe('Growl and Get The Horns', () => {
  test('the Use: needs a target and a combat; once per target per turn; rolls Intimidation (Strength) against Willpower', async () => {
    const growl = packItem('growl');
    const actor = makeActor([growl], { id: 'warthog' });
    const foe = makeActor([], { name: 'Foe' });
    game.user.targets = targetsOf(foe);
    expect(await runUse(growl, pay)).toContain('Growl needs a combat.');
    game.combat = { id: 'c1', round: 1, turn: 0, started: true };
    await runUse(growl, pay);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'intimidation', essence: 'strength', shiftUp: 0, shiftDown: 0, defenseType: 'willpower', isGrowl: true }), actor);
    expect(await runUse(growl, pay)).toContain('Growl has already been used against that target this turn.');
    game.combat.turn = 1;
    actor._dice.rollSkill.mockClear();
    await runUse(growl, pay);
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  // Book check (effects): Growl's ↑1 covers every attack on the target for the rest of the turn - the mark lasts the turn
  // and no attack uses it up.
  test('a hit on the first row marks the target for this turn; every attack on it gets ↑1; Get The Horns re-marks on a melee hit', async () => {
    const actor = makeActor([packItem('growl'), packItem('horns')], { id: 'warthog' });
    const other = makeActor([], { id: 'boar' });
    const foe = makeActor([], { name: 'Foe' });
    game.combat = { id: 'c1', round: 1, turn: 0, started: true };
    game.combats = { get: id => (id == 'c1' ? game.combat : null) };
    await fireTriggers(actor, 'hit', { roll: { dataset: { isGrowl: true } }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] }, vars: { row: 1 } });
    expect(foe.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(actor, 'hit', { roll: { dataset: { isGrowl: true } }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] }, vars: { row: 0 } });
    expect(foe.flags.essence20.ruleMarks['growl--warthog']).toEqual(expect.objectContaining({ by: actor.uuid, until: 'endOfTurn' }));
    foe.flags.essence20.ruleMarks['growl--boar'] = { by: other.uuid, until: null };
    const melee = attack(actor);
    const { sources, consumes } = ruleRollSources(actor, foe, { item: melee });
    expect(sources).toEqual([expect.objectContaining({ label: 'Growl', shiftUp: 1, key: 'growl' })]);
    expect(ruleRollSources(actor, makeActor(), { item: melee }).sources).toEqual([]);
    expect(ruleRollSources(actor, foe, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    expect(consumes.find(consume => consume.ext == 'rulesMarkOwn')).toBeUndefined();
    game.combat.turn = 1;
    expect(ruleRollSources(actor, foe, { item: melee }).sources).toEqual([]);
    game.combat.turn = 0;
    // Get The Horns: a melee hit with Growl's ↑ on the roll - the first such hit marks again.
    const once = new Set();
    const second = makeActor();
    await fireTriggers(actor, 'hit', { roll: { item: melee, isAttack: true, isMelee: true, switches: ['growl'] }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] }, vars: { row: 0 }, once });
    await fireTriggers(actor, 'hit', { roll: { item: melee, isAttack: true, isMelee: true, switches: ['growl'] }, outcome: 'success', targets: [second], facts: { results: [{ success: true }] }, vars: { row: 1 }, once });
    expect(foe.flags.essence20.ruleMarks['growl--warthog']).toBeDefined();
    expect(second.flags.essence20.ruleMarks).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Surging, Power Infusion                      */
/* -------------------------------------------- */

describe('Surging', () => {
  test('offered on its weapon\'s element attacks: a Free action, the base damage doubled, a natural 1 hits back', async () => {
    const actor = makeActor();
    const weapon = makeItem({ name: 'Blaster', type: 'weapon', system: { equipped: true } });
    weapon.parent = actor;
    actor.items.contents.push(weapon);
    const surging = packItem('surging', { flags: { parentId: weapon.id } });
    surging.parent = actor;
    actor.items.contents.push(surging);
    rebuildIndex(actor);
    const fire = attack(actor, { parentId: weapon.id, damageType: 'fire', style: 'ranged' });
    const sharp = attack(actor, { parentId: weapon.id, damageType: 'sharp' });
    expect(ruleDialogSwitches(actor, { item: sharp })).toEqual([]);
    const [toggle] = ruleDialogSwitches(actor, { item: fire });
    expect(toggle.value).toBe(false);
    const options = { ext: { [toggle.name]: true } };
    expect(await applySwitchActions(actor, options, { item: fire })).toBe(true);
    expect(spent).toEqual([{ name: 'Hero', action: 'free' }]);
    expect(options).toEqual(expect.objectContaining({ ruleBaseDamageMultiplier: 2, ruleBackfireOn: [1] }));
  });
});

describe('Power Infusion', () => {
  test('Morphed: 1 Personal Power, a reroll charge for the user and every Morphed Player Character within 60 ft, once per scene', async () => {
    const perk = packItem('powerInfusion', { system: { advances: { currentValue: 2 } } });
    const actor = makeActor([perk], { name: 'Blue' });
    expect(await runUse(perk, pay)).toContain('You must be Morphed to activate Power Infusion.');
    expect(actor.system.powers.personal.value).toBe(3);
    actor.system.isMorphed = true;
    const ally = makeActor([], { name: 'Red', system: { isMorphed: true } });
    const npc = makeActor([], { name: 'Putty', type: 'npc', system: { isMorphed: true } });
    const far = makeActor([], { name: 'Pink', system: { isMorphed: true } });
    const token = (who, x) => ({ actor: who, center: { x, y: 0 } });
    global.canvas = { tokens: { placeables: [token(actor, 0), token(ally, 50), token(npc, 10), token(far, 100)] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    actor.token = { object: token(actor, 0) };
    const line = await runUse(perk, pay);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(actor.flags.essence20.bankedReroll).toEqual({ values: [1, 2], source: 'Power Infusion' });
    expect(ally.flags.essence20.bankedReroll).toEqual({ values: [1, 2], source: 'Power Infusion' });
    expect(npc.flags.essence20.bankedReroll).toBeUndefined();
    expect(far.flags.essence20.bankedReroll).toBeUndefined();
    expect(line).toContain('Rerolls banked for: Blue, Red.');
    expect(await runUse(perk, pay)).toBeNull();
    expect(actor.system.powers.personal.value).toBe(2);
    delete global.canvas;
  });
});

/* -------------------------------------------- */
/*  Hard Corps, Exploit Weakness                 */
/* -------------------------------------------- */

describe('Hard Corps', () => {
  test('once per combat, confirmed: the damage is ignored and kept; when that combat ends, too little Health Defeats', async () => {
    const actor = makeActor([packItem('hardCorps')], { name: 'Marine' });
    game.combat = { id: 'c1', round: 1, turn: 0, started: true };
    const ask = jest.fn(async () => true);
    expect(await applyingDamageStage(actor, 5, { stage: 'lateReductions', hit: actor, ask })).toEqual({ damage: 0, dropSecondary: true, handled: false });
    expect(ask).toHaveBeenCalled();
    expect(actor.flags.essence20.ruleMarks.hardCorps).toEqual(expect.objectContaining({ count: 5, text: 'c1' }));
    expect(await applyingDamageStage(actor, 4, { stage: 'lateReductions', hit: actor, ask })).toEqual({ damage: 4, dropSecondary: false, handled: false });
    actor.system.health.value = 6;
    await fireTriggers(actor, 'combatEnd', { vars: { combatId: 'c2' } });
    expect(actor.flags.essence20.ruleMarks.hardCorps).toBeDefined();
    await fireTriggers(actor, 'combatEnd', { vars: { combatId: 'c1' } });
    expect(conditions).toEqual([]);
    expect(actor.flags.essence20.ruleMarks.hardCorps).toBeUndefined();
  });

  test('declined: the damage lands; Health below the debt at the end: Defeated', async () => {
    const actor = makeActor([packItem('hardCorps')], { name: 'Marine' });
    game.combat = { id: 'c1', round: 1, turn: 0, started: true };
    expect(await applyingDamageStage(actor, 5, { stage: 'lateReductions', hit: actor, ask: async () => false })).toEqual({ damage: 5, dropSecondary: false, handled: false });
    await applyingDamageStage(actor, 5, { stage: 'lateReductions', hit: actor, ask: async () => true });
    actor.system.health.value = 4;
    await fireTriggers(actor, 'combatEnd', { vars: { combatId: 'c1' } });
    expect(conditions).toEqual([{ name: 'Marine', status: 'defeated' }]);
  });
});

describe('Exploit Weakness', () => {
  test('a button on the holder\'s own melee cards with a target; a DIF 14 Alertness success lets them and their side ignore its armor this scene', async () => {
    const actor = makeActor([packItem('exploitWeakness')], { name: 'Yellow', disposition: 1 });
    const mate = makeActor([], { disposition: 1 });
    const foe = makeActor([], { disposition: -1 });
    const card = { id: 'm1', rolls: [{}], speaker: { actor: actor.id }, flags: { essence20: { isMelee: true, targetUuid: foe.uuid } }, update: jest.fn(async update => Object.entries(update).forEach(([k, v]) => setPath(card, k, v))) };
    expect(offersFor({ ...card, flags: { essence20: { isMelee: false, targetUuid: foe.uuid } } }, [actor])).toEqual([]);
    const [offer] = offersFor(card, [actor]);
    expect(offer.label).toContain('Exploit Weakness');
    rollResult = { success: true };
    expect(await pressOffer(card, { holderUuid: actor.uuid, itemId: offer.item.id, index: offer.index })).toBe(true);
    expect(rolls).toEqual([expect.objectContaining({ name: 'Yellow', skill: 'alertness', dif: 14 })]);
    expect(offersFor(card, [actor])).toEqual([]);
    expect(ruleMarkedNoArmor(mate, foe, 'toughness')).toBe(true);
    expect(ruleMarkedNoArmor(actor, foe, 'evasion')).toBe(true);
    expect(ruleMarkedNoArmor(makeActor([], { disposition: -1 }), foe, 'toughness')).toBe(false);
    epochs.sceneClockScene = 2;
    expect(ruleMarkedNoArmor(mate, foe, 'toughness')).toBe(false);
  });
});
