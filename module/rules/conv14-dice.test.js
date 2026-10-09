import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, part "dice" (docs/rules-batches/slDice14.md): item code keyed on compendium ids in module/dice.mjs (and the
 * helpers it called) moved onto the items' own rules. Each item is loaded from its pack source and must do what the
 * removed code (and its old tests in dice.test.js / banked-buffs.test.js / items/*.test.js) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const conditions = [];
const dealt = [];
let allies = [];
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => {
    conditions.push({ name: actor.name, status, rounds });
    actor.statuses?.add?.(status);
  }),
}));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type) => dealt.push({ name: actor.name, amount, type })),
}));
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  getNearbyAllyTokens: jest.fn((actor, radius) => allies.filter(entry => (entry.feet ?? 0) <= radius).map(entry => ({ actor: entry.actor }))),
  getAllNearbyTokens: jest.fn(() => []),
  getHissColumnBonus: () => 0,
  getColonyChangelingEvasionBonus: () => 0,
  pickAllyTargets: jest.fn(async (actor, candidates) => candidates.slice(0, 1)),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  hobble: 'dditems/_source/Hobble_TG0CSb60LTv7jNyv.json',
  guardianStrikes: 'jttitems/_source/Guardian_Strikes_U2Xj1jrRS4AP3uGd.json',
  spokes: 'qgtgitems/_source/Stick_In_The_Spokes_qf1HjLgmRGil2N7i.json',
  interdiction: 'fffav1items/_source/Interdiction_AyKHJdCpdtoZHlER.json',
  dirtyBlows: 'dditems/_source/Dirty_Blows_MvPfmzW4mh7TsMJo.json',
  leech: 'dditems/_source/Leech_Siphons_tn3WTWH4n1Gel5sO.json',
  iceFlechettes: 'fmmcitems/_source/Ice_Flechettes_Effect_vMoq7coIwWqEaTFI.json',
  iceFlechettesAlt: 'fmmcitems/_source/Ice_Flechettes_Alternate_Effect_5Y2brpJu5M8M0HV0.json',
  avalanche: 'fmmcitems/_source/Avalanche_Stomp_Effect_C3dsyh98mb4TDW9o.json',
  stunningSurprise: 'tfcrbitems/_source/Stunning_Surprise_6KrQp4s1o2ffGHhC.json',
  knockDown: 'tfcrbitems/_source/Knock_Down__Drag_Out_7VyNmcnl9DuuIKlp.json',
  catchOffGuard: 'sssitems/_source/Catch_Off_Guard_qplsg3JI3kmUCtU9.json',
  toughGetGoing: 'iafav2items/_source/The_Tough_Get_Going_OUtZ1DohGv4l9A5j.json',
  powerFilter: 'jttitems/_source/Power_Filter_4Kjn9FVissqtvwQy.json',
  iceMachine: 'iafav2items/_source/Ice_Machine_m4iS0VQn9z8o6FWy.json',
  stylishStrike: 'jttitems/_source/Stylish_Strike_9LYVJbnqO6BmxGXF.json',
  growingSmolder: 'fmmcitems/_source/Growing_Smolder_4XblFV97cS63ueDM.json',
  tryTryAgain: 'jttitems/_source/Try__Try_Again_bFJOnWaIKTDYjDDJ.json',
  arashikage: 'iafav2items/_source/Arashikage_Graduate_OhOdfAu7b0lLDO82.json',
  bruteForce: 'qgtgitems/_source/Brute_Force_Works_Best_oZVphHSTTBENUaFk.json',
  withoutAWord: 'iafav2items/_source/Without_a_Word_cZg52I6J5dLP6PjV.json',
  supportive: 'mlpcrbitems/_source/Supportive_Friend_YSK9hm3OkG6jKlAJ.json',
  extraSupportive: 'mlpcrbitems/_source/Extra_Supportive_Friend_nqunVQB7C5ldA7SK.json',
  superSupportive: 'mlpcrbitems/_source/Super_Supportive_Friend_T44FMLiQpwW9cV2u.json',
  supportYourself: 'mlpcrbitems/_source/Support_Yourself_OZrtQuRwCCzeKfV9.json',
  bulkedUp: 'ghpfitems/_source/Bulked_Up_Frame_ITvnVU4crafDWfjF.json',
  roadside: 'ghpfitems/_source/Roadside_Assistant_AAacA8jm6dyG0WEH.json',
  shockAndAwe: 'gijcrbitems/_source/Shock_and_Awe_a5HptfB7nYFLVHkc.json',
  platePiercing: 'gijcrbitems/_source/Plate_Piercing_II5giKn7vCDeB2nk.json',
  razeAndRuin: 'dditems/_source/Raze_And_Ruin_eYvcwtOPZ1Pt8q9X.json',
  alphaStrike: 'gijcrbitems/_source/Alpha_Strike_9EWv3qQJgj7WFQ9A.json',
  nowhereIsSafe: 'gijcrbitems/_source/Nowhere_is_Safe_oUAeJZ7K1P7Fu8Bc.json',
  cunningPlan: 'jttitems/_source/Cunning_Plan_gGqatrdFbt4VWML7.json',
  soloShot: 'jttitems/_source/Solo_Shot_SS1IgnoreRange10.json',
  emergencyCare: 'tfcrbitems/_source/Emergency_Care_Equipment_rUoirxlfrn2PBQwO.json',
  vehicleRepair: 'tfcrbitems/_source/Vehicle_Repair_Equipment_xX8Ijto8a0I4jbjt.json',
  informedAccuracy: 'tfcrbitems/_source/Informed_Accuracy_JtWhjDRI0HDewaKe.json',
  caution: 'tfcrbitems/_source/Caution_To_The_Wind_7jAU5Eg1uy9Hl1d4.json',
  inundation: 'gijcrbitems/_source/Inundation_Q09tkHIaVX65lokl.json',
  underestimate: 'bthitems/_source/Don_t_Underestimate_Me_IIGUmCKw8O8QogvE.json',
  straightShooter: 'tfcrbitems/_source/Straight_Shooter_I4Sy2sJIudLAeUlN.json',
  pythonized: 'fffav1items/_source/Pythonized_CaYTsrxD2JEs2dQM.json',
  exoskeleton: 'iafav2items/_source/Combat_Exoskeleton_6c5vuHhqfbMJ0p1L.json',
  terrifying: 'gijcrbitems/_source/Terrifying_tXHd0LBkVCB2QPPO.json',
  terrifyingTf: 'tfcrbitems/_source/Terrifying_tXHd0LBkVCB2QPPO.json',
  inventor: 'tfcrbitems/_source/Inventor_0A8SSXo0HkjyFcEA.json',
  flutteryWings: 'mlpcrbitems/_source/Fluttery_Wings_HO82viVmbKgmCAts.json',
  lightningSpeed: 'mlpcrbitems/_source/Lightning_Speed_trENOkDUbjra0BEN.json',
  summonArmor: 'mlpcrbitems/_source/Summon_Armor_VsUNcBtDmFmD1J6H.json',
  summonShield: 'mlpcrbitems/_source/Summon_Shield_XLRCF0VI1D9VZhkv.json',
  dontNotice: 'mlpcrbitems/_source/Don_t_Notice_Me_Field_JCt7GIYBonchb4TV.json',
  disguise: 'dsoeitems/_source/Disguise_N8kMxo82Rot2xMMU.json',
  hotToTrot: 'kocitems/_source/Hot_to_Trot_V6hbpi3LsDjyJXyW.json',
  greasedLightning: 'kocitems/_source/Greased_Lightning_vXYDWGbhhIBOx1Ic.json',
  mysterySense: 'kocitems/_source/Mystery_Sense_UUGqwGOps0Z2exEH.json',
  glittermane: 'kocitems/_source/Glittermane_WACDOLg6uFWlr2lc.json',
  ookieSpookies: 'kocitems/_source/Ookie_Spookies_JF7xsi8GtT4bCfWm.json',
  foolscarrot: 'kocitems/_source/Foolscarrot_doF1rRuMXaeAPDTl.json',
  blockMagic: 'kocitems/_source/Block_Magic_J1jUwu4IIuPxQE10.json',
  sparkleBlast: 'kocitems/_source/Sparkle_Blast_fZV6bakLGTEcHVst.json',
  snarl: 'fffav1items/_source/Snarl_786NTb2bQyHZ7qfg.json',
  mightMakesRight: 'dditems/_source/Might_Makes_Right_lIiVbzESbPpV7Egu.json',
  youCanDoIt: 'jttitems/_source/You_Can_Do_It__Too_o7Yn4EXPvYywe5AZ.json',
  outfoxed: 'mlpcrbitems/_source/Outfoxed_30WB5sRAQ3zhLmsz.json',
  butIShould: 'kocitems/_source/But_I_Should_Know_That_zO84wFyLjE9y6FsH.json',
  instinctual: 'kocitems/_source/Instinctual_Caster_ixNXVuXWjNf8fZHY.json',
  burly: 'sssitems/_source/Burly_NLwbluyB9dtHMTlT.json',
  saberToothed: 'fffav1items/_source/Saber_Toothed_RVGlDHOKipqZ1e7i.json',
  pseudoScience: 'wtnvcgitems/_source/_Pseudo__Science_MTo42tKWWtZ15Ist.json',
  ricochet: 'dditems/_source/Ricochet_4D98PWVya8KJ9Pna.json',
  disrupter: 'ccitems/_source/Disrupter_BPFc4FQgy9mFgPqG.json',
  balanceOfJustice: 'prcrbitems/_source/Ninja_Powered__Balance_of_Justice__wlXHbN4QHSBGbkTe.json',
  demolitionDriver: 'iafav2items/_source/Demolition_Driver_pCRDLA7XZ3auR2ZO.json',
  basicIntelligence: 'gijcrbitems/_source/Basic_Intelligence_ycwWXZhyxM15xgac.json',
  orangePrime: 'jttitems/_source/Orange_Ranger_Prime_8s9HHpmk633e6PLM.json',
  nowImAngry: 'dditems/_source/Now_I_m_Angry_eqOgBhx720rSSUTh.json',
  menacingGlare: 'bthitems/_source/Menacing_Glare_eWlflRHYAVB9p5Z0.json',
  augmented: 'atsitems/_source/Augmented_k76uXWWDpe0yKEcu.json',
  ironBravado: 'jttitems/_source/Iron_Bravado_8bmqJ7hyOAcVNB1Y.json',
};

let nextId = 1;
const ALL = [];

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
  item.setFlag = jest.fn(async (scope, key, value) => setPath(item, `flags.${scope}.${key}`, value));
  item.getFlag = (scope, key) => getPath(item.flags?.[scope], key);
  ALL.push(item);
  return item;
}

function packItem(key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, img: doc.img, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) },
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  });
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(extra.statuses ?? []),
    system: {
      level: 10, size: 'common', skills: {}, health: { max: 10, value: 10, bonus: 0 }, powers: { personal: { value: 3, max: 5 } },
      energon: { normal: { value: 2, max: 5 } }, resistances: {},
      defenses: { toughness: { total: 12 }, evasion: { total: 11 }, willpower: { total: 13 }, cleverness: { total: 15 } },
      ...(extra.system ?? {}),
    },
    effects: [],
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => [],
    toggleStatusEffect: jest.fn(async (status, { active } = {}) => (active === false ? actor.statuses.delete(status) : actor.statuses.add(status))),
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
  actor.getRollData = () => ({ skills: actor.system.skills });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  ALL.push(actor);
  rebuildIndex(actor);
  return actor;
}

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { runUse, useAvailable, fireTriggers } = await import('./triggers.mjs');
const { applyRuleSwitches, ruleDialogSwitches, ruleRollSources, ruleDefenseAdjust, ruleDamageType, ruleDieSubstitution, ruleConditionImmune, applyRuleImmunity } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { bankedEntries, bankedSources, bankedDefense } = await import('./bank.mjs');
const { evaluateTag, contextFor, markOf, registerCheck, setWorldLookups } = await import('./predicate.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');
const { markedTargetSources } = await import('./plugins/marks/rule-marks.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { applyCardHitMultipliers } = await import('./plugins/combat/card-hit-multiplier.mjs');
const { crewedVehicle } = await import('./plugins/zords/crewed-vehicle-recipient.mjs');
const { isTheToughGetGoingActive } = await import('../items/movement/the-tough-get-going.mjs');
const { isSummonArmorActive } = await import('../items/magic/summon-armor.mjs');

// essence20.mjs registers these (multiple-targets.mjs / condition-damage-buttons.mjs readings).
registerCheck('multipleTargetsWeapon', (actor, option, ctx) => (ctx?.item ? !!ctx.item.system?.multipleTargets : null));
registerCheck('favoriteWeaponRolled', (actor, option, ctx) => !!ctx?.item && ctx.item.flags?.essence20?.parentId == actor.flags.essence20.favoriteWeaponId);

let chooses = [];
const ask = async (step, options) => {
  const want = chooses.shift();
  const at = options.findIndex(option => option.label == want);
  return at < 0 ? null : at;
};

const pay = jest.fn(async () => true);
const use = item => runUse(item, pay, { ask });

const effect = (actor, data = {}) => {
  const one = makeItem({ name: data.name ?? 'Attack', type: 'weaponEffect', flags: { essence20: { ...(data.parentId ? { parentId: data.parentId } : {}) } },
    system: { classification: { style: data.style ?? 'melee', skill: data.skill ?? 'might' }, damageType: data.damageType ?? 'blunt', damageValue: 1, numHands: data.numHands ?? 1, ...(data.system ?? {}) } });
  one.parent = actor;
  actor.items.contents.push(one);
  rebuildIndex(actor);
  return one;
};

const roll = (item, extra = {}) => ({ item, rolledSkill: item?.system?.classification?.skill, isAttack: item?.type == 'weaponEffect', isMelee: item?.system?.classification?.style == 'melee', ...extra });
const hit = (actor, target, rolled, { outcome = 'success', results = [{ success: true, multiplier: outcome == 'double' ? 2 : 1, damageValue: 2 }], extra = {} } = {}) => fireTriggers(actor, 'hit', { roll: { ...roll(rolled), ...extra }, outcome, targets: [target], facts: { results, isCrit: outcome == 'crit', isFumble: false }, ask });
const afterRoll = (actor, rolled, { outcome = 'success', results = [{ success: true, multiplier: 1 }], extra = {}, vars = {} } = {}) => fireTriggers(actor, 'afterRoll', { roll: { ...roll(rolled), ...extra }, outcome, facts: { results, isCrit: false, isFumble: false }, vars, ask });
const switchesOf = (actor, ctx) => ruleDialogSwitches(actor, ctx);
const switchNamed = (actor, ctx, label) => switchesOf(actor, ctx).find(entry => entry.label.startsWith(label));
async function tick(actor, ctx, label, value = true, base = {}) {
  const entry = switchNamed(actor, ctx, label);
  const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ...base, ext: { [entry.name]: value } };
  await applyRuleSwitches(actor, options, ctx);
  return options;
}

function target(name, extra = {}) {
  return makeActor([], { name, type: extra.type ?? 'npc', statuses: extra.statuses, system: extra.system ?? {}, id: extra.id });
}

const setTargets = list => {
  const set = new Set(list.map(actor => ({ actor })));
  set.first = () => [...set][0];
  global.game.user.targets = set;
};

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = getPath;
  global.foundry.utils.deepClone = value => JSON.parse(JSON.stringify(value));
});

beforeEach(() => {
  chooses = [];
  allies = [];
  conditions.length = 0;
  dealt.length = 0;
  ALL.length = 0;
  pay.mockClear();
  global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => null), prompt: jest.fn(async () => null), confirm: jest.fn(async () => true) };
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.user.targets.first = () => undefined;
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1, set: async () => {} };
  Object.defineProperty(global.game, 'actors', {
    configurable: true,
    get: () => {
      const list = ALL.filter(doc => doc.documentName == 'Actor');
      return Object.assign(list, { contents: list, get: id => list.find(doc => doc.id == id) });
    },
  });
  global.game.i18n = { localize: k => k, format: k => k, has: () => false };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuid = jest.fn(async uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  setWorldLookups({ crewing: null });
});

test('every rule the batch added validates', () => {
  for (const key of Object.keys(FILES)) {
    const rules = fromPack(FILES[key]).system.rules ?? [];
    expect([key, rules.length > 0]).toEqual([key, true]);
    for (const rule of rules) {
      expect([key, validateRule(rule)]).toEqual([key, []]);
    }
  }
});

/* -------------------------------------------- */
/*  Declared attack switches                     */
/* -------------------------------------------- */

describe('Hobble / Guardian Strikes / Stick In The Spokes / Interdiction / Dirty Blows', () => {
  test('Hobble: offered on a ranged attack only; ticked it is ↓2 and carries its key; a hit asks for the Condition (untimed)', async () => {
    const raider = makeActor([packItem('hobble')]);
    const gun = effect(raider, { style: 'projectile' });
    const blade = effect(raider);
    expect(switchNamed(raider, { item: gun }, 'Hobble')).toBeTruthy();
    expect(switchNamed(raider, { item: blade }, 'Hobble')).toBeUndefined();
    const options = await tick(raider, { item: gun }, 'Hobble');
    expect([options.shiftDown, options.ruleKeys]).toEqual([2, ['hobble']]);
    const foe = target('Foe');
    chooses = ['Prone'];
    await hit(raider, foe, gun, { extra: { switches: ['hobble'] } });
    expect(conditions).toEqual([{ name: 'Foe', status: 'prone', rounds: 0 }]);
    conditions.length = 0;
    await hit(raider, foe, gun);
    expect(conditions).toEqual([]);
  });

  test('Guardian Strikes: two-handed melee only; ticked the attack forgoes its damage; a hit imposes the chosen Condition', async () => {
    const ranger = makeActor([packItem('guardianStrikes')]);
    const greatsword = effect(ranger, { numHands: 2 });
    expect(switchNamed(ranger, { item: effect(ranger) }, 'Guardian Strikes')).toBeUndefined();
    const options = await tick(ranger, { item: greatsword }, 'Guardian Strikes');
    expect([options.ruleNoDamage, options.shiftDown]).toEqual([true, 0]);
    chooses = ['Restrained'];
    await hit(ranger, target('Foe'), greatsword, { extra: { switches: ['guardianStrikes'] } });
    expect(conditions.map(c => c.status)).toEqual(['restrained']);
  });

  test('Stick In The Spokes: blade / bludgeon against a vehicle of no higher level, once per encounter; success -> inoperable, double -> Defeated', async () => {
    const disruptor = makeActor([packItem('spokes')], { system: { level: 10 } });
    const club = effect(disruptor, { damageType: 'blunt' });
    const laser = effect(disruptor, { damageType: 'energy' });
    const truck = target('Truck', { type: 'vehicle', system: { level: 1, threatLevel: 8 } });
    setTargets([truck]);
    expect(switchNamed(disruptor, { item: club }, 'Stick In The Spokes')).toBeTruthy();
    expect(switchNamed(disruptor, { item: laser }, 'Stick In The Spokes')).toBeUndefined();
    setTargets([target('Tank', { type: 'vehicle', system: { threatLevel: 12 } })]);
    expect(switchNamed(disruptor, { item: club }, 'Stick In The Spokes')).toBeUndefined();
    setTargets([truck]);
    const options = await tick(disruptor, { item: club }, 'Stick In The Spokes');
    expect(options.ruleNoDamage).toBe(true);
    await hit(disruptor, truck, club, { extra: { switches: ['stickInTheSpokes'] } });
    expect([truck.flags.essence20.stickInTheSpokesInoperable, truck.statuses.has('defeated')]).toEqual([true, false]);
    const other = target('Other Truck', { type: 'vehicle', system: { threatLevel: 3 } });
    await hit(disruptor, other, club, { outcome: 'double', extra: { switches: ['stickInTheSpokes'] } });
    expect([other.statuses.has('defeated'), other.flags.essence20.stickInTheSpokesInoperable]).toEqual([true, undefined]);
  });

  test('Interdiction: only against a lower-level target, once per encounter; any hit Defeats it instead of dealing damage', async () => {
    const recon = makeActor([packItem('interdiction')], { system: { level: 10 } });
    const knife = effect(recon);
    setTargets([target('Peer', { system: { threatLevel: 10 } })]);
    expect(switchNamed(recon, { item: knife }, 'Interdiction')).toBeUndefined();
    const mook = target('Mook', { system: { threatLevel: 4 } });
    setTargets([mook]);
    const options = await tick(recon, { item: knife }, 'Interdiction');
    expect(options.ruleNoDamage).toBe(true);
    await hit(recon, mook, knife, { extra: { switches: ['interdiction'] } });
    expect(conditions).toEqual([{ name: 'Mook', status: 'defeated', rounds: 0 }]);
  });

  test('Dirty Blows: offered on melee attacks; ticked, a hit leaves the target Impaired for 1 round', async () => {
    const brute = makeActor([packItem('dirtyBlows')]);
    const fist = effect(brute);
    expect(switchNamed(brute, { item: effect(brute, { style: 'projectile' }) }, 'Dirty Blows')).toBeUndefined();
    const options = await tick(brute, { item: fist }, 'Dirty Blows');
    expect(options.ruleKeys).toEqual(['dirtyBlows']);
    await hit(brute, target('Foe'), fist, { extra: { switches: ['dirtyBlows'] } });
    expect(conditions).toEqual([{ name: 'Foe', status: 'impaired', rounds: 1 }]);
  });
});

/* -------------------------------------------- */
/*  Hit riders                                   */
/* -------------------------------------------- */

describe('hit Triggers', () => {
  test('Leech Siphons: a double-or-better hit with its own weapon drains 1 Energon (if any) and gives the wielder 1, uncapped', async () => {
    const leech = packItem('leech', { flags: { parentId: 'blade' } });
    const bot = makeActor([leech], { system: { energon: { normal: { value: 5, max: 5 } } } });
    const blade = makeItem({ id: 'blade', name: 'Blade', type: 'weapon', system: { equipped: true } });
    blade.parent = bot;
    bot.items.contents.push(blade);
    rebuildIndex(bot);
    const slash = effect(bot, { parentId: 'blade' });
    const foe = target('Foe', { system: { energon: { normal: { value: 2 } } } });
    await hit(bot, foe, slash);
    expect([foe.system.energon.normal.value, bot.system.energon.normal.value]).toEqual([2, 5]);
    await hit(bot, foe, slash, { outcome: 'double' });
    expect([foe.system.energon.normal.value, bot.system.energon.normal.value]).toEqual([1, 6]);
    const dry = target('Dry', { system: { energon: { normal: { value: 0 } } } });
    await hit(bot, dry, slash, { outcome: 'double' });
    expect([dry.system.energon.normal.value, bot.system.energon.normal.value]).toEqual([0, 7]);
  });

  test('Ice Flechettes (both effects) strip armor for 1 round, Avalanche Stomp knocks Prone - on a double hit with the effect itself', async () => {
    for (const key of ['iceFlechettes', 'iceFlechettesAlt']) {
      conditions.length = 0;
      const own = packItem(key, { system: { classification: { style: 'projectile', skill: 'targeting' } } });
      const monster = makeActor([own]);
      await hit(monster, target('Foe'), own);
      await hit(monster, target('Foe'), own, { outcome: 'double' });
      expect(conditions).toEqual([{ name: 'Foe', status: 'armorStripped', rounds: 1 }]);
    }

    conditions.length = 0;
    const stomp = packItem('avalanche', { system: { classification: { style: 'melee', skill: 'might' } } });
    const golem = makeActor([stomp]);
    await hit(golem, target('Foe'), stomp, { outcome: 'double' });
    expect(conditions).toEqual([{ name: 'Foe', status: 'prone', rounds: 0 }]);
  });

  test('Stunning Surprise: Stun 1 against a Surprised target or while Invisible; Knock Down, Drag Out adds 1 round Unconscious 3+ levels down', async () => {
    const prowler = makeActor([packItem('stunningSurprise'), packItem('knockDown')], { system: { level: 12 } });
    const knife = effect(prowler);
    await hit(prowler, target('Aware', { system: { threatLevel: 2 } }), knife);
    expect(dealt).toEqual([]);
    await hit(prowler, target('Mook', { statuses: ['surprised'], system: { threatLevel: 9 } }), knife);
    expect(dealt).toEqual([{ name: 'Mook', amount: 1, type: 'stun' }]);
    expect(conditions).toEqual([{ name: 'Mook', status: 'unconscious', rounds: 1 }]);
    prowler.statuses.add('invisible');
    await hit(prowler, target('Boss', { system: { threatLevel: 11 } }), knife);
    expect(dealt.map(d => d.name)).toEqual(['Mook', 'Boss']);
    expect(conditions.map(c => c.name)).toEqual(['Mook']);
  });

  // Book check (effects): the book's "a surprised target" is the Surprised Condition, not "hasn't acted yet".
  test('Catch Off Guard: Stun 1 to a hit target with the Surprised Condition', async () => {
    const marauder = makeActor([packItem('catchOffGuard')]);
    const late = target('Late');
    const surprised = target('Surprised', { statuses: ['surprised'] });
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: surprised }, { actor: marauder }, { actor: late }] };
    global.game.combat.combatants = global.game.combat.turns;
    global.game.combat.turn = 1;
    await hit(marauder, late, effect(marauder));
    await hit(marauder, surprised, effect(marauder));
    expect(dealt).toEqual([{ name: 'Surprised', amount: 1, type: 'stun' }]);
  });

  // Book check (effects): Might Makes Right's Frightened is offered (prompt) and lasts 1 minute (12 rounds).
  test('Snarl: Intimidation success Frightens 1 round; Might Makes Right: a double Persuasion success offers Frightened for 12 rounds', async () => {
    const tiger = makeActor([packItem('snarl'), packItem('mightMakesRight')]);
    await hit(tiger, target('A'), null, { extra: { rolledSkill: 'intimidation' } });
    await hit(tiger, target('B'), null, { extra: { rolledSkill: 'persuasion' } });
    await hit(tiger, target('C'), null, { outcome: 'double', extra: { rolledSkill: 'persuasion' } });
    expect(conditions).toEqual([{ name: 'A', status: 'frightened', rounds: 1 }, { name: 'C', status: 'frightened', rounds: 12 }]);
    global.foundry.applications.api.DialogV2.confirm.mockResolvedValueOnce(false);
    await hit(tiger, target('D'), null, { outcome: 'double', extra: { rolledSkill: 'persuasion' } });
    expect(conditions.map(c => c.name)).toEqual(['A', 'C']);
  });

  test("Ice Machine: a Cold hit on an already Stunned target Immobilizes it (the card's damage type)", async () => {
    const guard = makeActor([packItem('iceMachine')]);
    await hit(guard, target('Stunned', { statuses: ['stunned'] }), null, { extra: { rollDamageType: 'cold' } });
    await hit(guard, target('Fine'), null, { extra: { rollDamageType: 'cold' } });
    await hit(guard, target('Hot', { statuses: ['stunned'] }), null, { extra: { rollDamageType: 'fire' } });
    expect(conditions).toEqual([{ name: 'Stunned', status: 'immobilized', rounds: 0 }]);
  });

  test('Brute Force Works Best / Shock and Awe bank their Snag (and ↓1) on the hit target for its next roll', async () => {
    const disruptor = makeActor([packItem('bruteForce'), packItem('shockAndAwe')]);
    const truck = target('Truck', { type: 'vehicle' });
    await hit(disruptor, truck, effect(disruptor, { damageType: 'sharp' }));
    expect(bankedEntries(truck).map(e => [e.label, e.snag, e.shiftDown])).toEqual([['Brute Force Works Best', true, 1]]);
    const soldier = target('Soldier');
    await hit(disruptor, soldier, effect(disruptor, { damageType: 'sharp' }));
    expect(bankedEntries(soldier)).toEqual([]);
    await hit(disruptor, soldier, effect(disruptor, { style: 'explosive', damageType: 'blunt' }));
    expect(bankedSources(soldier, null, { rolledSkill: 'athletics' }).sources.map(s => [s.label, s.snag])).toEqual([['Shock and Awe', true]]);
  });

  test('Nowhere is Safe: +1 on a Multiple Targets hit unless the target is in Total Cover; cover steps down one', async () => {
    const vanguard = makeActor([packItem('nowhereIsSafe')]);
    const burst = effect(vanguard, { style: 'projectile', system: { multipleTargets: true } });
    const open = target('Open');
    const behindWall = target('Wall', { statuses: ['totalCover'] });
    const result = { damageValue: 2 };
    const tools = { damageBonusNote: (row, amount) => (row.damageValue += amount) };
    hitRiderOnAttack(vanguard, open, result, { itemUuid: burst.uuid, style: 'projectile' }, tools);
    const walled = { damageValue: 2 };
    hitRiderOnAttack(vanguard, behindWall, walled, { itemUuid: burst.uuid, style: 'projectile' }, tools);
    expect([result.damageValue, walled.damageValue]).toEqual([3, 2]);
    const inCover = target('Cover', { statuses: ['cover'] });
    await hit(vanguard, inCover, burst);
    await hit(vanguard, behindWall, burst);
    expect([[...inCover.statuses], [...behindWall.statuses]]).toEqual([[], ['cover']]);
  });

  // Anonymous's Snag on a repeat Outwit is the upgrade's incoming rule (rules/conv15-items2.test.js).
  test('Inundation: a successful Outwit marks the target; a later Deception / Intimidation roll against it has an Edge', async () => {
    const psych = makeActor([packItem('inundation')], { id: 'psych' });
    const foe = target('Foe');
    expect(ruleRollSources(psych, foe, { rolledSkill: 'deception' }).sources).toEqual([]);
    await hit(psych, foe, null, { extra: { rolledSkill: 'deception', dataset: { isOutwit: true } } });
    expect(ruleRollSources(psych, foe, { rolledSkill: 'deception' }).sources.map(s => s.edge)).toEqual([true]);
    expect(ruleRollSources(psych, foe, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(Object.keys(foe.flags.essence20.ruleMarks)).toEqual(['outwitted--psych']);
  });

  test('Block Magic marks each hit target with the old scene-window flag', async () => {
    const own = packItem('blockMagic');
    const mage = makeActor([own]);
    const foe = target('Foe');
    await hit(mage, foe, own);
    expect(foe.flags.essence20.blockMagicActive).toEqual({ epoch: 1, window: 'scene', count: 1 });
  });

  test('Menacing Glare: the switch costs 1 Personal Power; a hit offers Snag (banked on them) / Edge (against them) / Frightened', async () => {
    const dark = makeActor([packItem('menacingGlare')], { id: 'dark' });
    const ctx = { rolledSkill: 'intimidation' };
    expect(switchNamed(dark, { rolledSkill: 'athletics' }, 'Menacing Glare (')).toBeUndefined();
    expect(switchesOf(dark, { rolledSkill: 'intimidation', dataset: {} }).map(entry => entry.label)).toEqual(['Menacing Glare (1 Personal Power)']);
    const options = await tick(dark, ctx, 'Menacing Glare (');
    expect([options.ruleKeys, dark.system.powers.personal.value]).toEqual([['menacingGlare'], 2]);
    const a = target('A');
    const b = target('B');
    const c = target('C');
    chooses = ['Snag on their next Skill Test', 'Edge on your next Skill Test against them', 'Frightened'];
    for (const foe of [a, b, c]) {
      await hit(dark, foe, null, { extra: { rolledSkill: 'intimidation', switches: ['menacingGlare'] } });
    }

    expect(bankedEntries(a).map(e => e.snag)).toEqual([true]);
    expect(ruleRollSources(dark, b, { rolledSkill: 'persuasion' }).sources.map(s => s.edge)).toEqual([true]);
    expect(ruleRollSources(dark, a, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    expect(conditions).toEqual([{ name: 'C', status: 'frightened', rounds: 0 }]);
  });
});

/* -------------------------------------------- */
/*  Targeted Triggers                            */
/* -------------------------------------------- */

describe('targeted Triggers', () => {
  test("The Tough Get Going: a missed Toughness roll marks it once per round - Ground Movement doubled while it lasts", async () => {
    const joe = makeActor([packItem('toughGetGoing')]);
    const foe = target('Foe');
    await fireTriggers(joe, 'targeted', { roll: { defenseType: 'evasion' }, outcome: 'failure', targets: [foe], facts: { results: [{ success: false }] } });
    expect(isTheToughGetGoingActive(joe)).toBe(false);
    await fireTriggers(joe, 'targeted', { roll: { defenseType: 'toughness' }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(isTheToughGetGoingActive(joe)).toBe(false);
    await fireTriggers(joe, 'targeted', { roll: { defenseType: 'toughness' }, outcome: 'failure', targets: [foe], facts: { results: [{ success: false }] } });
    expect(isTheToughGetGoingActive(joe)).toBe(true);
  });

  test("Power Filter: an Energy roll against the Zord's Toughness, hit or miss, gives its driver 1 Personal Power up to max", async () => {
    const pilot = makeActor([], { name: 'Pilot', system: { powers: { personal: { value: 4, max: 5 } } } });
    const zord = makeActor([packItem('powerFilter')], { type: 'zord', system: { actors: { p: { uuid: pilot.uuid, vehicleRole: 'driver' } } } });
    const foe = target('Foe');
    for (const outcome of ['failure', 'success', 'success']) {
      await fireTriggers(zord, 'targeted', { roll: { defenseType: 'toughness', rollDamageType: 'energy' }, outcome, targets: [foe], facts: { results: [{ success: outcome == 'success' }] } });
    }

    expect(pilot.system.powers.personal.value).toBe(5);
    pilot.system.powers.personal.value = 1;
    await fireTriggers(zord, 'targeted', { roll: { defenseType: 'evasion', rollDamageType: 'energy' }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    await fireTriggers(zord, 'targeted', { roll: { defenseType: 'toughness', rollDamageType: 'fire' }, outcome: 'success', targets: [foe], facts: { results: [{ success: true }] } });
    expect(pilot.system.powers.personal.value).toBe(1);
  });

  test("Now I'm Angry: a damaging Critical Success against the holder banks +1 damage for its next attack", async () => {
    const bot = makeActor([packItem('nowImAngry')]);
    const foe = target('Foe');
    await fireTriggers(bot, 'targeted', { roll: {}, outcome: 'success', targets: [foe], facts: { results: [{ success: true, damageValue: 2 }] } });
    expect(bankedEntries(bot)).toEqual([]);
    await fireTriggers(bot, 'targeted', { roll: {}, outcome: 'crit', targets: [foe], facts: { results: [{ success: true, damageValue: 2 }] } });
    const attack = effect(bot);
    expect(bankedSources(bot, foe, { item: attack, isAttack: true }).sources.map(s => s.damage)).toEqual([1]);
    expect(bankedSources(bot, foe, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  afterRoll Triggers                           */
/* -------------------------------------------- */

describe('afterRoll Triggers', () => {
  test('Try, Try Again: an all-failed roll banks ↑1 for the next roll of that Skill (fixed: not when nothing was rolled against)', async () => {
    const driven = makeActor([packItem('tryTryAgain')]);
    await afterRoll(driven, null, { outcome: 'failure', results: [], vars: { skill: 'athletics' } });
    expect(bankedEntries(driven)).toEqual([]);
    await afterRoll(driven, null, { outcome: 'failure', results: [{ success: false }], vars: { skill: 'athletics' } });
    expect(bankedSources(driven, null, { rolledSkill: 'athletics' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(bankedSources(driven, null, { rolledSkill: 'might' }).sources).toEqual([]);
  });

  test('Arashikage Graduate: once per scene, a failure banks ↓1 on the next roll (fixed: not on an empty result list)', async () => {
    const ninja = makeActor([packItem('arashikage')]);
    await afterRoll(ninja, null, { outcome: 'failure', results: [], vars: { skill: 'athletics' } });
    expect(bankedEntries(ninja)).toEqual([]);
    await afterRoll(ninja, null, { outcome: 'failure', results: [{ success: false }], vars: { skill: 'athletics' } });
    expect(bankedSources(ninja, null, { rolledSkill: 'might' }).sources.map(s => s.shiftDown)).toEqual([1]);
  });

  test('Supportive Friend tiers: a successful Empathy roll banks the best tier on allies within 60 ft (Support Yourself: you too)', async () => {
    const empathy = makeItem({ name: 'Empathy', type: 'perk', system: { choice: 'persuasion' }, flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ' } } });
    const pony = makeActor([empathy, packItem('supportive'), packItem('extraSupportive'), packItem('supportYourself')]);
    const near = makeActor([], { name: 'Near' });
    const far = makeActor([], { name: 'Far' });
    allies = [{ actor: near, feet: 30 }, { actor: far, feet: 90 }];
    await afterRoll(pony, null, { outcome: 'success', results: [{ success: true }], extra: { rolledSkill: 'athletics' } });
    expect(bankedEntries(near)).toEqual([]);
    await afterRoll(pony, null, { outcome: 'success', results: [{ success: true }], extra: { rolledSkill: 'persuasion' } });
    expect(bankedEntries(near).map(e => [e.label, e.shiftUp])).toEqual([['Extra Supportive Friend', 2]]);
    expect(bankedEntries(far)).toEqual([]);
    expect(bankedEntries(pony).map(e => [e.label, e.shiftUp])).toEqual([['Extra Supportive Friend', 2]]);
    const top = makeActor([makeItem({ ...empathy, id: undefined }), packItem('superSupportive')]);
    top.items.contents[0].system = { choice: 'persuasion' };
    allies = [{ actor: near, feet: 5 }];
    await afterRoll(top, null, { outcome: 'success', results: [{ success: true }], extra: { rolledSkill: 'persuasion' } });
    expect(bankedEntries(near).map(e => e.edge)).toContain(true);
  });

  test('Stylish Strike: a double melee hit clears Frightened / Impaired / Mesmerized from every ally', async () => {
    const ranger = makeActor([packItem('stylishStrike')]);
    const scared = makeActor([], { name: 'Scared', statuses: ['frightened', 'impaired', 'prone'] });
    allies = [{ actor: scared, feet: 500 }];
    await afterRoll(ranger, effect(ranger), { outcome: 'success', results: [{ success: true, multiplier: 1 }] });
    expect([...scared.statuses]).toEqual(['frightened', 'impaired', 'prone']);
    await afterRoll(ranger, effect(ranger), { outcome: 'double', results: [{ success: true, multiplier: 2 }] });
    expect([...scared.statuses]).toEqual(['prone']);
  });

  test('You Can Do It, Too!: a double result banks ↑1 on every ally until your next turn', async () => {
    const inspiring = makeActor([packItem('youCanDoIt')]);
    const friend = makeActor([], { name: 'Friend' });
    allies = [{ actor: friend, feet: 1000 }];
    await afterRoll(inspiring, null, { outcome: 'success', results: [{ success: true, multiplier: 1 }] });
    expect(bankedEntries(friend)).toEqual([]);
    await afterRoll(inspiring, null, { outcome: 'double', results: [{ success: true, multiplier: 2 }] });
    expect(bankedEntries(friend).map(e => [e.shiftUp, e.until])).toEqual([[1, 'nextTurn']]);
  });

  test('But I Should Know That / Instinctual Caster: a failed Spellcasting roll / spell banks a Snag / a ↓1 on the next Spellcasting', async () => {
    const scribe = makeActor([packItem('butIShould'), packItem('instinctual')]);
    const spell = makeItem({ name: 'Spell', type: 'spell', system: {} });
    await afterRoll(scribe, spell, { outcome: 'failure', results: [{ success: false }], extra: { rolledSkill: 'spellcasting' } });
    expect(bankedSources(scribe, null, { rolledSkill: 'athletics' }).sources.map(s => [s.label, s.snag])).toEqual([['But I Should Know That', true]]);
    expect(bankedSources(scribe, null, { rolledSkill: 'spellcasting' }).sources.map(s => s.label).sort()).toEqual(['But I Should Know That', 'Instinctual Caster']);
  });

  test('buff spells set the same Scene Clock flags the readers ask (target, else the caster) - on a success only', async () => {
    for (const [key, flag, onTarget] of [['flutteryWings', 'flutteryWingsActive', true], ['lightningSpeed', 'lightningSpeedActive', true], ['disguise', 'dsoeDisguiseActive', true],
      ['hotToTrot', 'hotToTrotActive', true], ['greasedLightning', 'greasedLightningActive', true], ['foolscarrot', 'foolscarrotActive', true],
      ['mysterySense', 'mysterySenseActive', false], ['glittermane', 'glittermaneActive', false], ['ookieSpookies', 'ookieSpookiesActive', false]]) {
      const spell = packItem(key);
      const caster = makeActor([spell], { name: 'Caster' });
      const friend = makeActor([], { name: 'Friend' });
      setTargets([]);
      await afterRoll(caster, spell, { outcome: 'failure', results: [{ success: false }] });
      expect([key, caster.flags.essence20[flag]]).toEqual([key, undefined]);
      await afterRoll(caster, spell, { outcome: 'success', results: [{ success: true }] });
      expect([key, caster.flags.essence20[flag]]).toEqual([key, { epoch: 1, window: 'scene', count: 1 }]);
      setTargets([friend]);
      await afterRoll(caster, spell, { outcome: 'success', results: [{ success: true }] });
      expect([key, !!friend.flags.essence20[flag]]).toEqual([key, onTarget]);
    }
  });

  test("Don't-Notice-Me-Field turns the target Invisible and sets its flag; Summon Armor / Shield mark it for the +2", async () => {
    const field = packItem('dontNotice');
    const caster = makeActor([field, packItem('summonArmor'), packItem('summonShield')]);
    const friend = makeActor([], { name: 'Friend' });
    setTargets([friend]);
    await afterRoll(caster, field, { outcome: 'success', results: [{ success: true }] });
    expect([conditions, friend.flags.essence20.dontNoticeMeFieldActive]).toEqual([[{ name: 'Friend', status: 'invisible', rounds: 0 }], { epoch: 1, window: 'scene', count: 1 }]);
    expect(isSummonArmorActive(friend)).toBe(false);
    await afterRoll(caster, caster.items.contents[1], { outcome: 'success', results: [{ success: true }] });
    expect([isSummonArmorActive(friend), friend.flags.essence20.ruleMarks.summonArmor.until]).toEqual([true, 'scene']);
    global.game.combat = { id: 'c', started: true, round: 2, turn: 0, turns: [], combatants: [] };
    const other = makeActor([], { name: 'Other' });
    setTargets([other]);
    await afterRoll(caster, caster.items.contents[2], { outcome: 'success', results: [{ success: true }] });
    expect(other.flags.essence20.ruleMarks.summonArmor.until).toBe('endOfNextRound');
    global.game.combat.round = 3;
    expect(isSummonArmorActive(other)).toBe(true);
    global.game.combat.round = 4;
    expect(isSummonArmorActive(other)).toBe(false);
  });

  test('Sparkle Blast: Blinds the targets (never the caster) for 3 rounds', async () => {
    const spell = packItem('sparkleBlast');
    const caster = makeActor([spell]);
    setTargets([target('A'), target('B')]);
    await afterRoll(caster, spell, { outcome: 'success', results: [{ success: true }] });
    expect(conditions).toEqual([{ name: 'A', status: 'blinded', rounds: 3 }, { name: 'B', status: 'blinded', rounds: 3 }]);
  });
});

/* -------------------------------------------- */
/*  Roll modifiers and switches                  */
/* -------------------------------------------- */

describe('roll modifiers, switches and Uses', () => {
  // Growing Smolder: the bonus is now on the following turn's attacks, not banked for the next one (book check
  // follow-ups 2026-10-06) - tested in book-followups.test.js.

  test('Cunning Plan: rolls the Cunning die instead (the shift difference) for 1 Personal Power; Pseudo-Science: Science while active', async () => {
    const orange = makeActor([packItem('cunningPlan')], { system: { skills: { athletics: { shift: 'd20' }, roleSkillDie: { shift: 'd8' } } } });
    const options = await tick(orange, { rolledSkill: 'athletics', baseShift: 'd20' }, 'Cunning Plan');
    expect([options.shiftUp, orange.system.powers.personal.value]).toEqual([4, 2]);
    const scientist = packItem('pseudoScience');
    const prof = makeActor([scientist], { system: { skills: { athletics: { shift: 'd4' }, science: { shift: 'd10' } } } });
    expect(switchNamed(prof, { rolledSkill: 'athletics' }, '"Pseudo"-Science')).toBeUndefined();
    await use(scientist);
    expect(prof.flags.essence20.pseudoScienceActive).toEqual({ epoch: 1, window: 'mission', count: 1 });
    expect(scientist.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use').some(({ rule, index }) => useAvailable(scientist, rule, index))).toBe(false);
    const swap = await tick(prof, { rolledSkill: 'athletics', baseShift: 'd4' }, '"Pseudo"-Science');
    expect(swap.shiftUp).toBe(3);
  });

  test('Solo Shot: ranged with the Quantum Defender Blaster, 1 Personal Power, clears the Snag', async () => {
    const quantum = makeActor([packItem('soloShot')]);
    const blaster = makeItem({ id: 'blaster', name: 'Blaster', type: 'weapon', system: { equipped: true }, flags: { core: { sourceId: 'Compendium.essence20.jump_through_time.Item.gOZtlnZubOZ01ZdF' } } });
    blaster.parent = quantum;
    quantum.items.contents.push(blaster);
    rebuildIndex(quantum);
    const shot = effect(quantum, { style: 'projectile', parentId: 'blaster' });
    expect(switchNamed(quantum, { item: effect(quantum, { style: 'projectile' }) }, 'Solo Shot')).toBeUndefined();
    const options = await tick(quantum, { item: shot }, 'Solo Shot', true, { snag: true });
    expect([options.snag, quantum.system.powers.personal.value]).toEqual([false, 2]);
  });

  test('Emergency Care / Vehicle Repair Equipment: no ↓ on the Specialization in Bot Mode', () => {
    const bot = makeActor([packItem('emergencyCare'), packItem('vehicleRepair')]);
    const science = { shiftDown: 3 };
    applyRuleImmunity(bot, science, { rolledSkill: 'science', dataset: { specializationKey: 'medicine' } });
    const tech = { shiftDown: 2 };
    applyRuleImmunity(bot, tech, { rolledSkill: 'technology', dataset: { specializationKey: 'demolitions' } });
    expect([science.shiftDown, tech.shiftDown]).toEqual([0, 2]);
    bot.system.altModeId = 'car';
    const altMode = { shiftDown: 3 };
    applyRuleImmunity(bot, altMode, { rolledSkill: 'science', dataset: { specializationKey: 'medicine' } });
    expect(altMode.shiftDown).toBe(3);
  });

  test('Informed Accuracy: ↑ per Analyze Target on that target', () => {
    const analyst = makeActor([packItem('informedAccuracy')], { flags: { analyzeTargetCounts: { 'Actor-foe': 2 } } });
    const foe = target('Foe', { id: 'foe' });
    expect(ruleRollSources(analyst, foe, { item: effect(analyst), isAttack: true }).sources.map(s => s.shiftUp)).toEqual([2]);
    expect(ruleRollSources(analyst, target('Other'), { item: effect(analyst), isAttack: true }).sources).toEqual([]);
  });

  test('Caution To The Wind: 0-3 traded for ↑ now and the same off every Defense on the next attack against you', async () => {
    const outrider = makeActor([packItem('caution')]);
    const entry = switchNamed(outrider, { rolledSkill: 'athletics' }, 'Caution To The Wind');
    expect([entry.type, entry.max]).toEqual(['number', 3]);
    const options = { shiftUp: 0, shiftDown: 0, ext: { [entry.name]: 2 } };
    await applyRuleSwitches(outrider, options, { rolledSkill: 'athletics' });
    expect(options.shiftUp).toBe(2);
    expect(await bankedDefense(outrider, 'evasion', target('Foe'), (doc, method, args) => doc[method](...args))).toBe(-2);
    expect(await bankedDefense(outrider, 'toughness', target('Foe'), (doc, method, args) => doc[method](...args))).toBe(0);
  });

  test("Don't Underestimate Me: the first roll each scene against an aware holder has a Snag", () => {
    const everyman = makeActor([packItem('underestimate')]);
    const foe = target('Foe');
    expect(ruleRollSources(foe, everyman, { rolledSkill: 'persuasion' }).sources.map(s => s.snag)).toEqual([true]);
    everyman.statuses.add('surprised');
    expect(ruleRollSources(foe, everyman, { rolledSkill: 'persuasion' }).sources).toEqual([]);
    everyman.statuses.delete('surprised');
    foe.statuses.add('invisible');
    expect(ruleRollSources(foe, everyman, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  });

  test('Straight Shooter: ↑1 on a ballistic attack that already carries an automatic ↓', () => {
    const gunslinger = makeActor([packItem('straightShooter')]);
    const gun = makeItem({ id: 'gun', name: 'Gun', type: 'weapon', system: { equipped: true, traits: ['ballistic'] } });
    gun.parent = gunslinger;
    gunslinger.items.contents.push(gun);
    rebuildIndex(gunslinger);
    const shot = effect(gunslinger, { style: 'projectile', parentId: 'gun' });
    expect(switchNamed(gunslinger, { item: shot, autoShiftDown: 0 }, 'Straight Shooter')).toBeUndefined();
    expect(switchNamed(gunslinger, { item: shot, autoShiftDown: 2 }, 'Straight Shooter')).toBeTruthy();
  });

  test('Pythonized (loose only) / Inventor offer an Edge switch; Inventor also takes back one ↓', async () => {
    const loose = makeActor([packItem('pythonized')]);
    expect(switchNamed(loose, { rolledSkill: 'infiltration' }, 'Pythonized')).toBeTruthy();
    expect(switchNamed(loose, { rolledSkill: 'athletics' }, 'Pythonized')).toBeUndefined();
    const fitted = makeActor([packItem('pythonized', { flags: { parentId: 'armor' } })]);
    expect(switchNamed(fitted, { rolledSkill: 'infiltration' }, 'Pythonized')).toBeUndefined();
    const inventor = makeActor([packItem('inventor')]);
    const options = await tick(inventor, { rolledSkill: 'technology' }, 'Inventor', true, { shiftDown: 2 });
    expect(options.edge).toBe(true);
  });

  test('Combat Exoskeleton ↑1 on Brawn and melee attacks; Burly ↑1 out of armor and out of vehicles', () => {
    const exo = makeActor([packItem('exoskeleton')]);
    expect(ruleRollSources(exo, null, { rolledSkill: 'brawn' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(ruleRollSources(exo, null, { item: effect(exo), isAttack: true, isMelee: true }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(ruleRollSources(exo, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    const marauder = makeActor([packItem('burly')]);
    expect(ruleRollSources(marauder, null, { rolledSkill: 'intimidation' }).sources.map(s => s.shiftUp)).toEqual([1]);
    const plate = makeItem({ name: 'Plate', type: 'armor', system: { equipped: true, classification: 'heavy' } });
    plate.parent = marauder;
    marauder.items.contents.push(plate);
    rebuildIndex(marauder);
    expect(ruleRollSources(marauder, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  });

  test('Terrifying: ↑1 on Intimidation while fitted to equipped armor, not beside its own pending Use bank', async () => {
    const armor = makeItem({ id: 'armor', name: 'Armor', type: 'armor', system: { equipped: true } });
    const upgrade = packItem('terrifying', { flags: { parentId: 'armor' } });
    const joe = makeActor([armor, upgrade]);
    expect(ruleRollSources(joe, null, { rolledSkill: 'intimidation' }).sources.map(s => s.shiftUp)).toEqual([1]);
    await use(upgrade);
    expect(ruleRollSources(joe, null, { rolledSkill: 'intimidation' }).sources.map(s => s.shiftUp)).toEqual([1]);
    expect(bankedEntries(joe).map(e => e.shiftUp)).toEqual([1]);
    const loose = makeActor([packItem('terrifyingTf')]);
    expect(ruleRollSources(loose, null, { rolledSkill: 'intimidation' }).sources).toEqual([]);
  });

  test('Ricochet: ↓1 for +1 damage with the Favorite Weapon, once per turn', async () => {
    const triggerbot = makeActor([packItem('ricochet')], { flags: { favoriteWeaponId: 'fav' } });
    const shot = effect(triggerbot, { style: 'projectile', parentId: 'fav' });
    expect(switchNamed(triggerbot, { item: effect(triggerbot, { parentId: 'other' }) }, 'Ricochet')).toBeUndefined();
    const options = await tick(triggerbot, { item: shot }, 'Ricochet');
    expect([options.shiftDown, options.ruleDamage]).toEqual([1, 1]);
  });

  test('Saber-Toothed: ↓1 on an unarmed attack, which then deals Sharp', async () => {
    const tiger = makeActor([packItem('saberToothed')]);
    const claws = effect(tiger);
    expect(switchNamed(tiger, { item: effect(tiger, { parentId: 'sword' }) }, 'Saber-Toothed')).toBeUndefined();
    const options = await tick(tiger, { item: claws }, 'Saber-Toothed');
    expect(options.shiftDown).toBe(1);
    expect(ruleDamageType(tiger, null, { item: claws, isAttack: true, switches: options.ruleKeys })).toBe('sharp');
    expect(ruleDamageType(tiger, null, { item: claws, isAttack: true, switches: [] })).toBeFalsy();
  });

  test('Alpha Strike: Edge on Might attacks, and attacks against you this round have an Edge', async () => {
    const kicker = makeActor([packItem('alphaStrike')], { id: 'kicker' });
    const punch = effect(kicker, { skill: 'might' });
    expect(switchNamed(kicker, { item: effect(kicker, { skill: 'targeting', style: 'projectile' }) }, 'Alpha Strike')).toBeUndefined();
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const options = await tick(kicker, { item: punch }, 'Alpha Strike');
    expect(options.edge).toBe(true);
    const foe = target('Foe');
    expect(ruleRollSources(foe, kicker, { item: effect(foe), isAttack: true }).sources.map(s => s.edge)).toEqual([true]);
    expect(ruleRollSources(foe, kicker, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  });

  test('Demolition Driver: the driver lets the vehicle trade up to ↓3 for that much extra damage on a Ram', async () => {
    const driver = makeActor([packItem('demolitionDriver')], { name: 'Driver' });
    const truck = makeActor([], { type: 'vehicle', system: { actors: { d: { uuid: driver.uuid, vehicleRole: 'driver' } } } });
    rebuildIndex(driver);
    const ram = effect(truck, { system: { isRam: true } });
    const entry = switchNamed(truck, { item: ram }, 'Demolition Driver');
    expect([entry?.type, entry?.max]).toEqual(['number', 3]);
    const options = { shiftUp: 0, shiftDown: 0, ext: { [entry.name]: 2 } };
    await applyRuleSwitches(truck, options, { item: ram });
    expect([options.shiftDown, options.ruleDamage]).toEqual([2, 2]);
  });

  test('Disrupter: Edge on Initiative when an enemy combatant is higher level', () => {
    const iconoclast = makeActor([packItem('disrupter')], { system: { level: 5 } });
    const boss = target('Boss', { system: { threatLevel: 8 } });
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [], combatants: [{ actor: boss }] };
    expect(ruleRollSources(iconoclast, null, { dataset: { isInitiative: true } }).sources.map(s => s.edge)).toEqual([true]);
    global.game.combat.combatants = [{ actor: target('Mook', { system: { threatLevel: 2 } }) }];
    expect(ruleRollSources(iconoclast, null, { dataset: { isInitiative: true } }).sources).toEqual([]);
  });

  test('Basic Intelligence: an untrained roll uses a d2 and loses its Snag', () => {
    const expert = makeActor([packItem('basicIntelligence')]);
    const result = ruleDieSubstitution(expert, null, { rolledSkill: 'science', dataset: { shift: 'd20' } }, 'd20');
    expect([result.shift, result.clearSnag]).toEqual(['d2', true]);
  });

  test('Outfoxed: a failed Infiltration roll lets that creature roll with an Edge against you', async () => {
    const tricky = makeActor([packItem('outfoxed')], { id: 'tricky' });
    const guard = target('Guard');
    await fireTriggers(tricky, 'miss', { roll: { rolledSkill: 'infiltration' }, outcome: 'failure', targets: [guard], facts: { results: [{ success: false }] } });
    expect(ruleRollSources(guard, tricky, { rolledSkill: 'alertness' }).sources.map(s => s.edge)).toEqual([true]);
    expect(ruleRollSources(guard, target('Other'), { rolledSkill: 'alertness' }).sources).toEqual([]);
  });

  test('Orange Ranger Prime: Snag on attacks against its Cleverness (late); the Use regains 2d2 Personal Power once per encounter', async () => {
    const prime = packItem('orangePrime');
    const orange = makeActor([prime], { system: { powers: { personal: { value: 5, max: 5 } } } });
    const lateRule = prime.system.rules.find(rule => rule.type == 'RollModifier');
    expect([lateRule.scope, lateRule.late, lateRule.snag, lateRule.when]).toEqual(['incoming', true, true, ['defense:cleverness']]);
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
      }

      async evaluate() {
        this.total = 3;
        return this;
      }
    };
    await use(prime);
    expect(orange.system.powers.personal.value).toBeGreaterThan(5);
  });
});

/* -------------------------------------------- */
/*  Defenses, multipliers, immunity, initiative  */
/* -------------------------------------------- */

describe('Defenses and the rest', () => {
  test('Without a Word: +1 to the attacked Defense in combat while some enemy is Frightened / Mesmerized / Surprised', () => {
    const ninja = makeActor([packItem('withoutAWord')]);
    const foe = target('Foe');
    const scared = target('Scared', { statuses: ['frightened'] });
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    global.canvas = { tokens: { placeables: [{ actor: ninja }, { actor: foe }] } };
    expect(lateDefenseAdjust(foe, ninja, 'evasion', { difficulty: 10 })).toBe(0);
    global.canvas.tokens.placeables.push({ actor: scared });
    expect(lateDefenseAdjust(foe, ninja, 'evasion', { difficulty: 10 })).toBe(1);
    global.game.combat = null;
    expect(lateDefenseAdjust(foe, ninja, 'evasion', { difficulty: 10 })).toBe(0);
  });

  test('Bulked Up Frame: + Brawn Ranks to Toughness while no armor is equipped', () => {
    const joe = makeActor([packItem('bulkedUp')], { system: { skills: { brawn: { shift: 'd6', isSpecialized: true } } } });
    expect(lateDefenseAdjust(target('Foe'), joe, 'toughness', { difficulty: 12 })).toBe(4);
    expect(lateDefenseAdjust(target('Foe'), joe, 'evasion', { difficulty: 12 })).toBe(0);
    const vest = makeItem({ name: 'Vest', type: 'armor', system: { equipped: true } });
    vest.parent = joe;
    joe.items.contents.push(vest);
    rebuildIndex(joe);
    expect(lateDefenseAdjust(target('Foe'), joe, 'toughness', { difficulty: 12 })).toBe(0);
  });

  test('Augmented: the chosen damage type halves the Defense (round up)', () => {
    const augmented = makeActor([packItem('augmented', { system: { choice: 'fire' } })]);
    const foe = target('Foe');
    const torch = effect(foe, { damageType: 'fire' });
    expect(ruleDefenseAdjust(foe, augmented, 'toughness', { item: torch, isAttack: true, difficulty: 13 })).toBe(-6);
    expect(ruleDefenseAdjust(foe, augmented, 'toughness', { item: effect(foe, { damageType: 'cold' }), isAttack: true, difficulty: 13 })).toBe(0);
  });

  test('Plate Piercing / Raze And Ruin multiply the card rows (vehicle x2 explosive; Huge+ vehicle x3, Huge+ Immobilized x2)', async () => {
    const artillery = makeActor([packItem('platePiercing'), packItem('razeAndRuin')]);
    const shell = effect(artillery, { style: 'explosive' });
    const small = target('Jeep', { type: 'vehicle' });
    const big = target('Carrier', { type: 'vehicle', system: { size: 'huge' } });
    const giant = target('Giant', { statuses: ['immobilized'], system: { size: 'gigantic' } });
    const loose = target('Loose', { system: { size: 'huge' } });
    const rows = [small, big, giant, loose].map(actor => ({ targetUuid: actor.uuid, damageValue: 5 }));
    await applyCardHitMultipliers(artillery, rows, { riderContext: { itemUuid: shell.uuid, style: 'explosive' } });
    expect(rows.map(row => row.damageValue)).toEqual([10, 30, 10, 5]);
    const melee = effect(artillery);
    const meleeRows = [{ targetUuid: big.uuid, damageValue: 5 }];
    await applyCardHitMultipliers(artillery, meleeRows, { riderContext: { itemUuid: melee.uuid, style: 'melee' } });
    expect(meleeRows[0].damageValue).toBe(5);
  });

  test('Iron Bravado: attacking marks it immune to Frightened (through the next round in combat)', async () => {
    const ranger = makeActor([packItem('ironBravado')]);
    expect(ruleConditionImmune(ranger, 'frightened')).toBeFalsy();
    await fireTriggers(ranger, 'beforeRoll', { roll: { item: effect(ranger), dataset: {} } });
    expect(markOf(ranger, 'ironBravado')).toBe(true);
    expect(ruleConditionImmune(ranger, 'frightened')).toBeTruthy();
    expect(ruleConditionImmune(ranger, 'prone')).toBeFalsy();
  });

  test('Balance of Justice: a Zord attacking marks its first target this round; attacks against it have an Edge', async () => {
    const zord = makeActor([packItem('balanceOfJustice')], { type: 'zord', id: 'zord' });
    const foe = target('Foe');
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    setTargets([foe]);
    await fireTriggers(zord, 'beforeRoll', { roll: { item: effect(zord), dataset: {} } });
    const ally = makeActor([], { name: 'Ally' });
    expect(markedTargetSources(ally, foe, { item: effect(ally), isAttack: true }).sources.map(s => s.edge)).toEqual([true]);
  });

  test('Roadside Assistant: rolling Initiative while crewing gives the vehicle +1 Bonus Health, once per encounter', async () => {
    const mechanic = makeActor([packItem('roadside')], { name: 'Mechanic' });
    const van = makeActor([], { type: 'vehicle', system: { health: { bonus: 0 }, actors: { m: { uuid: mechanic.uuid, vehicleRole: 'passenger' } } } });
    setWorldLookups({ crewing: actor => (actor === mechanic ? { vehicle: van, role: 'passenger' } : null) });
    expect(crewedVehicle(mechanic)).toEqual([van]);
    await fireTriggers(mechanic, 'initiativeRolling');
    await fireTriggers(mechanic, 'initiativeRolling');
    expect(van.system.health.bonus).toBe(1);
  });

  test('the roll:damageType and roll:autoDownshift tags', () => {
    expect(evaluateTag('roll:damageType:cold', contextFor({ rollDamageType: 'cold' }))).toBe(true);
    expect(evaluateTag('roll:damageType:cold', contextFor({ rollDamageType: 'fire' }))).toBe(false);
    expect(evaluateTag('roll:damageType:cold', contextFor({}))).toBe(null);
    expect(evaluateTag('roll:autoDownshift', contextFor({ autoShiftDown: 1 }))).toBe(true);
    expect(evaluateTag('roll:autoDownshift', contextFor({ autoShiftDown: 0 }))).toBe(false);
  });
});
