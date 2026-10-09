import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, part "dice" (docs/rules-batches/slDice15.md): the dice survey's "piece" items (and round 14's leftovers)
 * moved onto their own rules once the engine pieces they needed were built. Each item is loaded from its pack source
 * and must do what the removed code (and its old tests in dice.test.js / banked-buffs.test.js / items/*.test.js) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

const conditions = [];
const dealt = [];
let allies = [];
// The Story Point helpers (story-points.mjs pulls in the settings module): writable unless a test says otherwise.
const storyPoints = { canWrite: true, granted: [], spent: [] };
jest.unstable_mockModule('./mechanics/resources/story-points.mjs', () => ({
  canWriteStoryPoints: () => storyPoints.canWrite,
  poolFor: actor => (actor?.type == 'npc' ? 'gm' : 'story'),
  requestStoryPointGrant: jest.fn(async (actor, amount, options) => storyPoints.granted.push({ name: actor?.name, amount, pool: options?.pool ?? 'story' })),
  canSpendForActor: () => true,
  spendForActor: jest.fn(async (actor, amount) => storyPoints.spent.push({ name: actor?.name, amount })),
  hasStoryPointsAvailable: () => true,
}));
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
  weImprovise: 'tf1sitems/_source/We_Improvise_qnRFb2A0sLpSg2sL.json',
  stayHumble: 'mlpcrbitems/_source/Stay_Humble_awEvTH8rrDeqL2Oo.json',
  shootsAndScores: 'mlpcrbitems/_source/Shoots_and_Scores_ciWHdEjMnqAxBkZi.json',
  vibratingPalm: 'iafav2items/_source/Vibrating_Palm_L98MDWiqeH8fp2Fz.json',
  tilAllAreOne: 'eocitems/_source/Til_All_Are_One_GHuWfqHhMaskG4hT.json',
  itsRightThere: 'wtnvcgitems/_source/It_s_Right_There_PHg5CJEy13v6G7a1.json',
  academicStudies: 'wtnvcgitems/_source/Academic_Studies_zKyFqePOc7wElWcL.json',
  showOfHands: 'fgtaaitems/_source/Show_Of_Hands_tLAchrH1qQxk3CBJ.json',
  emptyHands: 'iafav2items/_source/Empty_Hands_t6ACZEOz99JWWHyg.json',
  brazenStrike: 'jttitems/_source/Brazen_Strike_zUmuHsSmS3u7bRro.json',
  smash: 'eocitems/_source/Smash__psPOXCaZFo7yiRzD.json',
  flameWarlord: 'fmmcitems/_source/Flame_Warlord_TPrNnDxBKHIajafY.json',
  evasive: 'iafav2items/_source/Evasive_pa4D7BibxH7jW0BA.json',
  psychWarfare: 'gijcrbitems/_source/Psychological_Warfare_GvXCxr0Uj7jPhqJR.json',
  scapegoat: 'ccitems/_source/Scapegoat_yMihdpSe5ntjRN3R.json',
  tacticalGymnastics: 'ghpfitems/_source/Tactical_Gymnastics_b5WD6Y13Fvhl6ZTe.json',
  splitSecond: 'jttitems/_source/Split_Second_Reaction_QhC7lX08bSPyfdkD.json',
  psychoanalyst: 'tfcrbitems/_source/Psychoanalyst_5X4NOluWwc7fv497.json',
  coaxSurrender: 'ghpfitems/_source/Coax_Surrender_zMtDS7NhRXcL6Epm.json',
  grinder: 'dditems/_source/Grinder_uUdwh8byuta9GehB.json',
  deceptiveWarfare: 'gijcrbitems/_source/Deceptive_Warfare_3XV6tQfl7WVvjEKe.json',
  precision: 'tfcrbitems/_source/Precision_r6nEmY5FD3I6WQoY.json',
  devastating: 'prcrbitems/_source/Devastating_Strike_qxO7qYqdB0QUwJxe.json',
  suckerPunch: 'eocitems/_source/Sucker_Punch_QSH8oFXlVKxq2iKJ.json',
  expertiseMlp: 'mlpcrbitems/_source/Expertise_06cSi4Q1ztUPXWtw.json',
  expertisePr: 'prcrbitems/_source/Expertise_uoCQgYOCeIQNzF0q.json',
  lowTech: 'jttitems/_source/Low_Tech_Priorities_khD9UfuqUQ4rWSUP.json',
  quietAsTheGrave: 'gijcrbitems/_source/Quiet_As_The_Grave_UJTt3hP5OwQHBcpf.json',
  debilitating: 'gijcrbitems/_source/Debilitating_Strike_dYaTU9IYI3vB5eHs.json',
  hardHitter: 'fmmcitems/_source/Hard_Hitter_L8wFtP1y6PQYJJVL.json',
  ballisticsPrecision: 'eocitems/_source/Ballistics_Precision_KyqWYbVVxuECXXmv.json',
  nowhereToRun: 'dditems/_source/Nowhere_to_Run_SyYuTRXeaZy4De3B.json',
  menace: 'gijcrbitems/_source/Menace_rzALUHpTq12OLZ6B.json',
  cqb: 'qgtgitems/_source/CQB_Training_HBwUVB3ur8WV9fsF.json',
  vantagePoint: 'dditems/_source/Vantage_Point_j8s0vIsIEUJzAAvy.json',
  asAbove: 'qgtgitems/_source/As_Above_QAOI7O3yVmmMpFEu.json',
  soBelow: 'qgtgitems/_source/So_Below_MlEYEVW4YXT4P0sP.json',
  trajectory: 'gijcrbitems/_source/Trajectory_B7pPkcsYGscY94W3.json',
  tacticalTriangulation: 'eocitems/_source/Tactical_Triangulation_weK6qeL2EmoNQk04.json',
  worstNightmare: 'ghpfitems/_source/Worst_Nightmare_eju1fItsi7O0utmh.json',
  gangUp: 'fmmcitems/_source/Gang_Up_Y18J55UVsdm2aB7E.json',
  teamFocus: 'prcrbitems/_source/Team_Focus_tKonXkoNsZhajHp9.json',
  witheringFire: 'iafav2items/_source/Withering_Fire_7NYq9SpPjODuHF8R.json',
  sadistic: 'dditems/_source/Sadistic_a7ch8kMSbxLSxbAB.json',
  heavyOrdnance: 'gijcrbitems/_source/Heavy_Ordnance_b2viBBrNk08Kc9ts.json',
  evolvedInstincts: 'jttitems/_source/Evolved_Instincts_fQM1keWndscbxBLJ.json',
  whenPush: 'eocitems/_source/When_Push_Comes_To_Shove_SKmwkT3O5TIAVusJ.json',
  jacketWrestler: 'iafav2items/_source/Jacket_Wrestler_59masYwRaPC1AuhQ.json',
  genius: 'gijcrbitems/_source/Genius_ENRpxMCws91Ny19y.json',
  deepWisdom: 'prcrbitems/_source/Ninja_Powered__Deep_Wisdom__wvJFH2HbSWNab25M.json',
  maximizeFlaws: 'fmmcitems/_source/Maximize_Flaws_jGa15CyuKXhq3IV2.json',
  jackOfAllTrades: 'gijcrbitems/_source/Jack_Of_All_Trades_f8ik7h2S3OakNJRq.json',
  timeTraveler: 'jttitems/_source/Time_Traveler_4OGaAf7j1W8ZaGSs.json',
  advantageous: 'jttitems/_source/Advantageous_Fighter_efcjaYwJpsBUlVN3.json',
  programmable: 'fgtaaitems/_source/Programmable_qPPgeJcB5BMd1jHB.json',
  badTemper: 'dditems/_source/Bad_Temper_pTaF0TVS3ZiWerzs.json',
  somethingToProve: 'dditems/_source/Something_To_Prove_LopI86yM8zyBHU7O.json',
  expertInYourField: 'gijcrbitems/_source/Expert_in_Your_Field_mnLXHQ2TwR3A42fS.json',
  sabotage: 'ccitems/_source/Sabotage_35KMOMI1iPdBPhHl.json',
  differentPerspective: 'dsoeitems/_source/Different_Perspective_Q4npyOz8iYHHy2LV.json',
  kindButFirm: 'mlpcrbitems/_source/Kind__But_Firm_kh28DVKbBxMcnMmd.json',
  rollingThunder: 'sssitems/_source/Rolling_Thunder_O5vyi2mvtWAtkE92.json',
  rumble: 'sssitems/_source/Rumble_In_The_Jungle_mMT0yiFOtiiD32hI.json',
  worthAShot: 'tfcrbitems/_source/Worth_A_Shot_vy2UDq5CABjOouZm.json',
  worthAnotherShot: 'tfcrbitems/_source/Worth_Another_Shot_x0Xnad3gsPQQmaaG.json',
  imaginative: 'dditems/_source/Imaginative_Engineering_DWWXdrhaWMDnNhNQ.json',
  friendlyFire: 'qgtgitems/_source/_Friendly__Fire_CwsHTrQION565onG.json',
  beloved: 'jttitems/_source/Beloved_wXbkcyQTziLjCYEC.json',
  fastDraw: 'dditems/_source/Fast_Draw_gKa6h1IXhYeWWm1e.json',
  antiAir: 'qgtgitems/_source/Anti_Air_Combat_Training_dTlLdrlWAZeZHJ7B.json',
  sizeMatters: 'dditems/_source/Size_Matters_soK9eLazbNwtVbLu.json',
  disarmingShot: 'ghpfitems/_source/Disarming_Shot_b4v1GUBwSqnCTozq.json',
  doubleAgent: 'tsitems/_source/Double_Agent_WjTeOJJJmntm6JgT.json',
  quantumCut: 'jttitems/_source/Quantum_Cut_9DhE4UzSl40c8lW4.json',
  drillingShot: 'tfcrbitems/_source/Drilling_Shot_M0aeDLMOUTy7ju90.json',
  penetratingAim: 'dditems/_source/Penetrating_Aim_Ill7m9IwlyXY0FMe.json',
  glow: 'kocitems/_source/Glow_pGXJEVMqygJhFDgn.json',
  panacea: 'mlpcrbitems/_source/Panacea_q2rDpOJq7d5xyMia.json',
  immovableObject: 'gijcrbitems/_source/Immovable_Object_QSHsA1peMncG196r.json',
  protectorsShield: 'gijcrbitems/_source/Protector_s_Shield_tGdWBibKFTYfXzVu.json',
  fightingStyle: 'gijcrbitems/_source/Fighting_Style_2LtDCHxgg9bMvWQK.json',
  titanBody: 'prcrbitems/_source/Titan_Body_a8qeX4JiDdAKfxyl.json',
  unseenStrike: 'atsitems/_source/Unseen_Strike_EYdpn9PL4iNrQPkh.json',
  penetratingShot: 'prcrbitems/_source/Penetrating_Shot_6ay8OIRRwZTnQUV8.json',
  splinterDefense: 'atsitems/_source/Splinter_Defense_YGY0lYvqbsiQcpHs.json',
  beamVolley: 'mlpcrbitems/_source/Beam_Volley_UhkhFqFDYjub1a8k.json',
  voidshield: 'atsitems/_source/Voidshield_6VOeIAu2XaPGV78P.json',
  emptyTheMag: 'gijcrbitems/_source/Empty_The_Mag_zbrr3W30rFTDTayX.json',
  packMule: 'kocitems/_source/Pack_Mule_Ysyt5rIcVK42NHPp.json',
  energonEfficiency: 'dditems/_source/Energon_Efficiency_ZtRBGtnV5HCA7zhl.json',
  ambitious: 'tf1sitems/_source/Ambitious_eLoPulLITRqroJu5.json',
  unlucky: 'bthitems/_source/Unlucky__For_You__hSzY2uhu3L9nGP6o.json',
  misled: 'mlpcrbitems/_source/Misled_PkbtskVfOkyz7Nty.json',
  moveLikeASong: 'prcrbitems/_source/Move_Like_a_Song_3ax1l5TpluxcSp4o.json',
  consistent: 'ccitems/_source/Consistent_vaAhMXXlzNWHIikR.json',
  violent: 'ccitems/_source/Violent_Y5mmouv5YKWhQlIn.json',
  drivingStrike: 'fmmcitems/_source/Driving_Strike_bP55ciUhiMJzyTGC.json',
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
const { applyRuleSwitches, ruleDialogSwitches, ruleRollSources, ruleDefenseAdjust, ruleDieSubstitution, applyRuleImmunity, rollRules, ruleNoLongRangeSnag } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { bankedEntries, bankedSources } = await import('./bank.mjs');
const { markOf, registerCheck, setWorldLookups } = await import('./predicate.mjs');

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


const { ruleFumbleStoryPoints } = await import('./plugins/resources/grant-story-point.mjs');
const { ruleSkillEssence } = await import('./plugins/rolls/skill-essence.mjs');
const storyPointHelpers = await import('../mechanics/resources/story-points.mjs');
const { setStoryPointHelpers } = await import('./steps.mjs');

beforeEach(() => {
  storyPoints.canWrite = true;
  storyPoints.granted = [];
  storyPoints.spent = [];
  setStoryPointHelpers(storyPointHelpers);
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
/*  Story Point grants                           */
/* -------------------------------------------- */

describe('Story Point grants (grantStoryPoint / FumbleStoryPoints)', () => {
  test('We Improvise: the first Initiative in a combat adds a Story Point and marks the old encounter flag; not again, not outside combat, not with nobody to write it', async () => {
    const bot = makeActor([packItem('weImprovise')], { name: 'Bot' });
    await fireTriggers(bot, 'initiativeRolling');
    expect(storyPoints.granted).toEqual([]);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    storyPoints.canWrite = false;
    await fireTriggers(bot, 'initiativeRolling');
    expect(storyPoints.granted).toEqual([]);
    expect(bot.flags.essence20.weImproviseUsedThisEncounter).toBeUndefined();
    storyPoints.canWrite = true;
    await fireTriggers(bot, 'initiativeRolling');
    expect(storyPoints.granted).toEqual([{ name: 'Bot', amount: 1, pool: 'story' }]);
    expect(bot.flags.essence20.weImproviseUsedThisEncounter).toEqual(expect.objectContaining({ window: 'encounter', count: 1 }));
    await fireTriggers(bot, 'initiativeRolling');
    expect(storyPoints.granted.length).toBe(1);
  });

  test('Stay Humble: any failed row of a Persuasion roll grants a Friendship Point; not on a success, not on another Skill', async () => {
    const pony = makeActor([packItem('stayHumble')], { name: 'Pony' });
    const failed = [{ success: false, multiplier: 0 }, { success: true, multiplier: 1 }];
    await afterRoll(pony, null, { outcome: 'success', results: failed, extra: { rolledSkill: 'persuasion' } });
    expect(storyPoints.granted).toEqual([{ name: 'Pony', amount: 1, pool: 'story' }]);
    await afterRoll(pony, null, { outcome: 'success', results: [{ success: true, multiplier: 1 }], extra: { rolledSkill: 'persuasion' } });
    await afterRoll(pony, null, { outcome: 'failure', results: [{ success: false, multiplier: 0 }], extra: { rolledSkill: 'athletics' } });
    storyPoints.canWrite = false;
    await afterRoll(pony, null, { outcome: 'failure', results: [{ success: false, multiplier: 0 }], extra: { rolledSkill: 'persuasion' } });
    expect(storyPoints.granted.length).toBe(1);
  });

  test('Shoots and Scores: a row at double the DIF on Athletics grants a point; a plain success or another Skill does not', async () => {
    const pony = makeActor([packItem('shootsAndScores')], { name: 'Pony' });
    await afterRoll(pony, null, { outcome: 'success', results: [{ success: true, multiplier: 1 }], extra: { rolledSkill: 'athletics' } });
    await afterRoll(pony, null, { outcome: 'double', results: [{ success: true, multiplier: 2 }], extra: { rolledSkill: 'acrobatics' } });
    expect(storyPoints.granted).toEqual([]);
    await afterRoll(pony, null, { outcome: 'double', results: [{ success: true, multiplier: 2 }], extra: { rolledSkill: 'athletics' } });
    expect(storyPoints.granted).toEqual([{ name: 'Pony', amount: 1, pool: 'story' }]);
  });

  test("'Til All Are One: any Critical Success grants a point once per encounter - the use is only spent when the point was written", async () => {
    const bot = makeActor([packItem('tilAllAreOne')], { name: 'Bot' });
    const crit = { outcome: 'double', results: [{ success: true, multiplier: 2 }], extra: { rolledSkill: 'technology' } };
    storyPoints.canWrite = false;
    await afterRoll(bot, null, crit);
    storyPoints.canWrite = true;
    await afterRoll(bot, null, crit);
    await afterRoll(bot, null, crit);
    expect(storyPoints.granted).toEqual([{ name: 'Bot', amount: 1, pool: 'story' }]);
  });

  test('Vibrating Palm: a Critical Success with an unarmed attack grants a point once per encounter (spent even with nobody to write it); armed attacks never', async () => {
    const ninja = makeActor([packItem('vibratingPalm')], { name: 'Ninja' });
    const fist = effect(ninja);
    const sword = effect(ninja, { parentId: 'w1' });
    const crit = { outcome: 'double', results: [{ success: true, multiplier: 2 }] };
    await afterRoll(ninja, sword, crit);
    expect(storyPoints.granted).toEqual([]);
    storyPoints.canWrite = false;
    await afterRoll(ninja, fist, crit);
    storyPoints.canWrite = true;
    await afterRoll(ninja, fist, crit);
    expect(storyPoints.granted).toEqual([]);
  });

  test('Vibrating Palm Use: spends a Story Point and Defeats the first target (Health 0); needs a target first', async () => {
    const palm = packItem('vibratingPalm');
    makeActor([palm], { name: 'Ninja' });
    setTargets([]);
    await use(palm);
    expect(storyPoints.spent).toEqual([]);
    const foe = target('Foe', { system: { health: { value: 7, max: 7 } } });
    setTargets([foe, target('Other')]);
    await use(palm);
    expect(storyPoints.spent).toEqual([{ name: 'Ninja', amount: 1 }]);
    expect(foe.system.health.value).toBe(0);
    expect(foe.statuses.has('defeated')).toBe(true);
  });

  test("It's Right There: the Fumble grant is 2; Academic Studies: 2 only with the chosen Skill; otherwise 1", () => {
    expect(ruleFumbleStoryPoints(makeActor([]), { rolledSkill: 'culture' })).toBe(1);
    expect(ruleFumbleStoryPoints(makeActor([packItem('itsRightThere')]), { rolledSkill: 'culture' })).toBe(2);
    const student = makeActor([packItem('academicStudies', { system: { choice: 'culture' } })]);
    expect(ruleFumbleStoryPoints(student, { rolledSkill: 'culture' })).toBe(2);
    expect(ruleFumbleStoryPoints(student, { rolledSkill: 'athletics' })).toBe(1);
  });

  test('Academic Studies: the chosen Skill rolls as Smarts; another Skill, or no choice, keeps its own Essence', () => {
    const student = makeActor([packItem('academicStudies', { system: { choice: 'finesse' } })]);
    expect(ruleSkillEssence(student, { rolledSkill: 'finesse' })).toBe('smarts');
    expect(ruleSkillEssence(student, { rolledSkill: 'might' })).toBe(null);
    expect(ruleSkillEssence(makeActor([packItem('academicStudies')]), { rolledSkill: 'finesse' })).toBe(null);
  });
});

/* -------------------------------------------- */
/*  Unarmed (attack:barehanded), card damage     */
/* -------------------------------------------- */

const { applyCardHitMultipliers } = await import('./plugins/combat/card-hit-multiplier.mjs');
const { ruleDamageTaken } = await import('./adapter.mjs');
const PRINTED_UNARMED = 'Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy';

/** A weapon on the actor (equipped unless said) and one attack of it. */
function weaponWith(actor, { source = null, equipped = true, style = 'melee' } = {}) {
  const weapon = makeItem({ name: 'Weapon', type: 'weapon', flags: { core: source ? { sourceId: source } : {} }, system: { equipped } });
  weapon.parent = actor;
  actor.items.contents.push(weapon);
  const attack = effect(actor, { parentId: weapon.id, style });
  return { weapon, attack };
}

describe('unarmed attacks the dice.mjs way (attack:barehanded)', () => {
  test('Show Of Hands: Edge on Deception / Intimidation / Persuasion with no weapon equipped and no unarmed attack this scene', async () => {
    const envoy = makeActor([packItem('showOfHands')]);
    const sources = skill => ruleRollSources(envoy, null, { rolledSkill: skill }).sources;
    expect(sources('persuasion').some(source => source.edge)).toBe(true);
    expect(sources('athletics').some(source => source.edge)).toBe(false);
    // An unarmed attack (a printed Unarmed Combat attack counts) marks the scene.
    const { weapon, attack } = weaponWith(envoy, { source: PRINTED_UNARMED, equipped: false });
    await afterRoll(envoy, attack, { outcome: null, results: [] });
    expect(envoy.flags.essence20.showOfHandsUnarmedAttackUsedThisScene).toEqual(expect.objectContaining({ window: 'scene', count: 1 }));
    expect(sources('persuasion').some(source => source.edge)).toBe(false);
    // Any equipped weapon - even the printed unarmed one - turns it off.
    delete envoy.flags.essence20.showOfHandsUnarmedAttackUsedThisScene;
    weapon.system.equipped = true;
    rebuildIndex(envoy);
    expect(sources('deception').some(source => source.edge)).toBe(false);
  });

  test("Empty Hands: Edge on an unarmed attack (no weapon, or a printed Unarmed weapon's) while no other weapon is equipped", () => {
    const fighter = makeActor([packItem('emptyHands')]);
    const fist = effect(fighter);
    const { attack: combat } = weaponWith(fighter, { source: PRINTED_UNARMED });
    const edge = item => ruleRollSources(fighter, null, roll(item)).sources.some(source => source.edge);
    expect([edge(fist), edge(combat)]).toEqual([true, true]);
    const { attack: blade } = weaponWith(fighter);
    expect([edge(fist), edge(blade)]).toEqual([false, false]);
  });

  test('Brazen Strike: an unarmed roll with a damaging hit ends Frightened and Mesmerized; a miss, or no damage, does not', async () => {
    const ranger = makeActor([packItem('brazenStrike')], { statuses: ['frightened', 'mesmerized', 'prone'] });
    const fist = effect(ranger);
    await afterRoll(ranger, fist, { outcome: 'failure', results: [{ success: false, multiplier: 0, damageValue: null }] });
    await afterRoll(ranger, fist, { outcome: 'success', results: [{ success: true, multiplier: 1, damageValue: null }] });
    expect([...ranger.statuses]).toEqual(['frightened', 'mesmerized', 'prone']);
    await afterRoll(ranger, fist, { outcome: 'success', results: [{ success: false, multiplier: 0, damageValue: null }, { success: true, multiplier: 1, damageValue: 2 }] });
    expect([...ranger.statuses]).toEqual(['prone']);
  });

  test('Smash!: +1 damage per Size Class larger on the row itself (none to add to: none), and a hit knocks the smaller target Prone', async () => {
    const pugilist = makeActor([packItem('smash')], { system: { size: 'large' } });
    const fist = effect(pugilist);
    const small = target('Small', { system: { size: 'small' } });
    const same = target('Same', { system: { size: 'large' } });
    const rows = [{ targetUuid: small.uuid, damageValue: 1, success: true, multiplier: 1 }, { targetUuid: same.uuid, damageValue: 1, success: true, multiplier: 1 }];
    await applyCardHitMultipliers(pugilist, rows, { riderContext: { itemUuid: fist.uuid, style: 'melee' } });
    expect(rows.map(row => row.damageValue)).toEqual([3, 1]);
    await hit(pugilist, small, fist);
    await hit(pugilist, same, fist);
    expect(conditions.length + small.statuses.size).toBeGreaterThan(0);
    expect(small.statuses.has('prone')).toBe(true);
    expect(same.statuses.has('prone')).toBe(false);
    // An armed attack: nothing.
    const { attack: blade } = weaponWith(pugilist);
    const armed = [{ targetUuid: small.uuid, damageValue: 1, success: true, multiplier: 1 }];
    await applyCardHitMultipliers(pugilist, armed, { riderContext: { itemUuid: blade.uuid, style: 'melee' } });
    expect(armed[0].damageValue).toBe(1);
  });

  test('Flame Warlord: +1 on a Critical Success row only; -1 to non-Energy damage taken in Monster Form', async () => {
    registerCheck('monsterForm', actor => !!actor?.flags?.essence20?.monsterFormActive);
    const warlord = makeActor([packItem('flameWarlord')]);
    const foe = target('Foe');
    const rows = [{ targetUuid: foe.uuid, damageValue: 2, success: true, multiplier: 2 }, { targetUuid: foe.uuid, damageValue: 1, success: true, multiplier: 1 }];
    await applyCardHitMultipliers(warlord, rows, { riderContext: {} });
    expect(rows.map(row => row.damageValue)).toEqual([3, 1]);
    expect([ruleDamageTaken(warlord, 3, 'blunt'), ruleDamageTaken(warlord, 3, 'fire')]).toEqual([3, 3]);
    warlord.flags.essence20.monsterFormActive = true;
    expect([ruleDamageTaken(warlord, 3, 'blunt'), ruleDamageTaken(warlord, 3, 'poison'), ruleDamageTaken(warlord, 3, 'fire'), ruleDamageTaken(warlord, 0, 'poison')]).toEqual([2, 2, 3, 0]);
  });
});

/* -------------------------------------------- */
/*  Early Defense rules (early-defense.mjs)      */
/* -------------------------------------------- */

const { earlyDefenseAdjust } = await import('./plugins/combat/early-defense.mjs');

describe("Defense early: true - the old 'use Evasion when it's better' Perks", () => {
  // The other Defenses' per-attack values (dice.mjs hands getDefenseValue + Shield Upgrade).
  const values = { toughness: 12, evasion: 15, willpower: 10, cleverness: 14 };
  const valueOf = key => values[key];
  const attackOf = (attacker, traits = []) => {
    const gun = makeItem({ name: 'Gun', type: 'weapon', system: { traits, equipped: true } });
    gun.parent = attacker;
    attacker.items.contents.push(gun);
    return effect(attacker, { parentId: gun.id, style: 'projectile' });
  };

  const adjust = (attacker, defender, type, difficulty, item) => earlyDefenseAdjust(attacker, defender, type, difficulty, { item, valueOf });

  test('Evasive: any Defense is the better of itself and Evasion', async () => {
    const ninja = makeActor([packItem('evasive')]);
    const raider = makeActor([]);
    const shot = attackOf(raider);
    expect((await adjust(raider, ninja, 'toughness', 12, shot)).difficulty).toBe(15);
    expect((await adjust(raider, ninja, 'cleverness', 17, shot)).difficulty).toBe(17);
    expect((await adjust(raider, makeActor([]), 'toughness', 12, shot)).difficulty).toBe(12);
  });

  test('Psychological Warfare: Willpower / Cleverness only', async () => {
    const commando = makeActor([packItem('psychWarfare')]);
    const raider = makeActor([]);
    expect((await adjust(raider, commando, 'willpower', 10, null)).difficulty).toBe(15);
    expect((await adjust(raider, commando, 'cleverness', 14, null)).difficulty).toBe(15);
    expect((await adjust(raider, commando, 'toughness', 12, null)).difficulty).toBe(12);
  });

  test('Scapegoat: Willpower <-> Cleverness when the other is higher, once per scene - spent only when it swapped', async () => {
    const viper = makeActor([packItem('scapegoat')]);
    const raider = makeActor([]);
    expect(await adjust(raider, viper, 'cleverness', 14, null)).toEqual({ difficulty: 14, changed: [] });
    expect(await adjust(raider, viper, 'toughness', 8, null)).toEqual({ difficulty: 8, changed: [] });
    expect(await adjust(raider, viper, 'willpower', 10, null)).toEqual({ difficulty: 14, changed: ['scapegoat'] });
    expect(await adjust(raider, viper, 'willpower', 10, null)).toEqual({ difficulty: 10, changed: [] });
    values.willpower = 16;
    expect((await adjust(raider, viper, 'cleverness', 11, null)).difficulty).toBe(11);
    values.willpower = 10;
  });

  test('Tactical Gymnastics: unarmored, Acrobatics Ranks on Evasion; against a Ballistic attack the better of the Defense and Evasion (+ Ranks unarmored)', async () => {
    const gymnast = makeActor([packItem('tacticalGymnastics')], { system: { skills: { acrobatics: { shift: 'd6', isSpecialized: false } } } });
    const raider = makeActor([]);
    const rifle = attackOf(raider, ['ballistic']);
    const bow = attackOf(raider, []);
    expect((await adjust(raider, gymnast, 'evasion', 15, bow)).difficulty).toBe(18);
    expect((await adjust(raider, gymnast, 'toughness', 12, bow)).difficulty).toBe(12);
    expect((await adjust(raider, gymnast, 'toughness', 12, rifle)).difficulty).toBe(18);
    // Armored: no Ranks, the plain Evasion swap still.
    const vest = makeItem({ name: 'Vest', type: 'armor', system: { equipped: true } });
    vest.parent = gymnast;
    gymnast.items.contents.push(vest);
    rebuildIndex(gymnast);
    expect((await adjust(raider, gymnast, 'evasion', 15, bow)).difficulty).toBe(15);
    expect((await adjust(raider, gymnast, 'toughness', 12, rifle)).difficulty).toBe(15);
  });

  test('Split-Second Reaction: Evasion against Ballistic attacks only', async () => {
    const ranger = makeActor([packItem('splitSecond')]);
    const raider = makeActor([]);
    expect((await adjust(raider, ranger, 'toughness', 12, attackOf(raider, ['ballistic']))).difficulty).toBe(15);
    expect((await adjust(raider, ranger, 'toughness', 12, attackOf(raider, []))).difficulty).toBe(12);
  });

  test('early rules are never sheet bonuses or ruleDefenseAdjust ones', () => {
    const gymnast = makeActor([packItem('tacticalGymnastics'), packItem('evasive')], { system: { skills: { acrobatics: { shift: 'd6' } } } });
    expect(ruleDefenseAdjust(makeActor([]), gymnast, 'evasion', { difficulty: 15 })).toBe(0);
  });
});

/* -------------------------------------------- */
/*  DialogSwitch syntheticDamage                 */
/* -------------------------------------------- */

describe('DialogSwitch syntheticDamage - a Skill Test that deals damage on a success', () => {
  test('Psychoanalyst (Science / Technology: 2 Stun), Coax Surrender (Persuasion: 1 Stun), Deceptive Warfare (an Outwit: 1 Psychic) - offered there only, never remembered', async () => {
    const analyst = makeActor([packItem('psychoanalyst'), packItem('coaxSurrender'), packItem('deceptiveWarfare')]);
    expect(switchNamed(analyst, { rolledSkill: 'science' }, 'Psychoanalyst')).toBeTruthy();
    expect(switchNamed(analyst, { rolledSkill: 'technology' }, 'Psychoanalyst')).toBeTruthy();
    expect(switchNamed(analyst, { rolledSkill: 'culture' }, 'Psychoanalyst')).toBeUndefined();
    expect((await tick(analyst, { rolledSkill: 'science' }, 'Psychoanalyst')).ruleSyntheticDamage).toEqual({ value: 2, type: 'stun' });
    expect((await tick(analyst, { rolledSkill: 'persuasion' }, 'Coax Surrender')).ruleSyntheticDamage).toEqual({ value: 1, type: 'stun' });
    expect(switchNamed(analyst, { rolledSkill: 'deception', dataset: {} }, 'Deceptive Warfare')).toBeUndefined();
    expect((await tick(analyst, { rolledSkill: 'deception', dataset: { isOutwit: true } }, 'Deceptive Warfare')).ruleSyntheticDamage).toEqual({ value: 1, type: 'psychic' });
    expect(switchNamed(analyst, { rolledSkill: 'science' }, 'Psychoanalyst').value).toBe(false);
    const untouched = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ext: {} };
    await applyRuleSwitches(analyst, untouched, { rolledSkill: 'science' });
    expect(untouched.ruleSyntheticDamage).toBeUndefined();
  });

  test('Grinder: 2 Blunt on a Brawn test; its Critical Success hit Impairs the target (untimed)', async () => {
    const brute = makeActor([packItem('grinder')]);
    expect(switchNamed(brute, { rolledSkill: 'athletics' }, 'Grinder')).toBeUndefined();
    const options = await tick(brute, { rolledSkill: 'brawn' }, 'Grinder');
    expect([options.ruleSyntheticDamage, options.ruleKeys]).toEqual([{ value: 2, type: 'blunt' }, ['grinder']]);
    const foe = target('Foe');
    await hit(brute, foe, null, { extra: { rolledSkill: 'brawn', switches: ['grinder'] } });
    expect(conditions).toEqual([]);
    await hit(brute, foe, null, { outcome: 'double', extra: { rolledSkill: 'brawn', switches: ['grinder'] } });
    expect(conditions).toEqual([{ name: 'Foe', status: 'impaired', rounds: 0 }]);
  });
});

/* -------------------------------------------- */
/*  Multiplier (Degrees of Success)              */
/* -------------------------------------------- */

const { ruleMultipliers } = await import('./plugins/rolls/degree-multiplier.mjs');

describe('Multiplier - the row Degrees of Success', () => {
  const rollOf = item => ({ item, rolledSkill: 'might', isAttack: item?.type == 'weaponEffect', isMelee: item?.system?.classification?.style == 'melee' });

  test('Precision: on an attack with a DIF, x2 at 10+ over it instead of double; a plain roll keeps doubling', () => {
    const spec = makeActor([packItem('precision')]);
    const shot = effect(spec, { style: 'projectile' });
    const rules = ruleMultipliers(spec, rollOf(shot));
    expect(rules.adjust({ difficulty: 12 }, 1, 'early', 22)).toBe(2);
    expect(rules.adjust({ difficulty: 12 }, 1, 'early', 21)).toBe(1);
    expect(rules.adjust({ difficulty: 10 }, 2, 'early', 20)).toBe(2);
    expect(rules.adjust({ difficulty: 15 }, 2, 'early', 30)).toBe(2);
    expect(rules.adjust({ difficulty: 15 }, 0, 'early', 14)).toBe(0);
    expect(ruleMultipliers(spec, { rolledSkill: 'culture', isAttack: false }).adjust({ difficulty: 10 }, 2, 'early', 20)).toBe(2);
    expect(ruleMultipliers(spec, { rolledSkill: 'culture', isAttack: false }).adjust({ difficulty: 10 }, 1, 'early', 19)).toBe(1);
  });

  test('Devastating Strike: a melee x2 row becomes x3; ranged, or x1, unchanged', () => {
    const ranger = makeActor([packItem('devastating')]);
    const sword = effect(ranger);
    const gun = effect(ranger, { style: 'projectile' });
    expect(ruleMultipliers(ranger, rollOf(sword)).adjust({ difficulty: 10 }, 2, 'early', 20)).toBe(3);
    expect(ruleMultipliers(ranger, rollOf(sword)).adjust({ difficulty: 10 }, 1, 'early', 12)).toBe(1);
    expect(ruleMultipliers(ranger, rollOf(gun)).adjust({ difficulty: 10 }, 2, 'early', 20)).toBe(2);
  });

  test("Sucker Punch: in round 1, an unarmed success against a target that hasn't acted becomes x2, once per encounter", async () => {
    const pugilist = makeActor([packItem('suckerPunch')]);
    const fist = effect(pugilist);
    const early = target('Early');
    const late = target('Late');
    const turns = [{ actor: pugilist }, { actor: early }, { actor: late }];
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 1, turns, combatants: turns };
    const rules = ruleMultipliers(pugilist, rollOf(fist));
    expect(rules.adjust({ targetUuid: early.uuid, difficulty: 10 }, 1, 'promote', 12)).toBe(1);
    expect(rules.adjust({ targetUuid: late.uuid, difficulty: 10 }, 1, 'promote', 12)).toBe(2);
    expect(rules.adjust({ targetUuid: late.uuid, difficulty: 10 }, 0, 'promote', 8)).toBe(0);
    await rules.spend();
    expect(ruleMultipliers(pugilist, rollOf(fist)).adjust({ targetUuid: late.uuid, difficulty: 10 }, 1, 'promote', 12)).toBe(1);
    // Round 2, or armed: nothing.
    const fresh = makeActor([packItem('suckerPunch')]);
    const armed = effect(fresh, { parentId: 'w1' });
    expect(ruleMultipliers(fresh, rollOf(armed)).adjust({ targetUuid: late.uuid, difficulty: 10 }, 1, 'promote', 12)).toBe(1);
    global.game.combat.round = 2;
    expect(ruleMultipliers(fresh, rollOf(effect(fresh))).adjust({ targetUuid: late.uuid, difficulty: 10 }, 1, 'promote', 12)).toBe(1);
  });
});

/* -------------------------------------------- */
/*  DownshiftCancel (pre-dialog)                 */
/* -------------------------------------------- */

const { ruleDownshiftCancel } = await import('./plugins/rolls/downshift-cancel.mjs');

describe('DownshiftCancel - one ↓ off the stacked total before the dialog', () => {
  test('Expertise: -1 on the chosen Skill only; two copies for it (either printing) still cancel 1; nothing to cancel, nothing', async () => {
    const expert = makeActor([packItem('expertiseMlp', { system: { choice: 'athletics' } }), packItem('expertisePr', { system: { choice: 'athletics' } })]);
    expect(await ruleDownshiftCancel(expert, 2, { rolledSkill: 'athletics' })).toBe(1);
    expect(await ruleDownshiftCancel(expert, 0, { rolledSkill: 'athletics' })).toBe(0);
    expect(await ruleDownshiftCancel(expert, 2, { rolledSkill: 'culture' })).toBe(2);
    const twoSkills = makeActor([packItem('expertiseMlp', { system: { choice: 'athletics' } }), packItem('expertiseMlp', { system: { choice: 'culture' } })]);
    expect(await ruleDownshiftCancel(twoSkills, 1, { rolledSkill: 'culture' })).toBe(0);
  });

  test('Low Tech Priorities: -1 on either chosen Skill once per turn across both copies; spent only when it cancelled one', async () => {
    const turns = [];
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns, combatants: turns };
    const hero = makeActor([packItem('lowTech', { system: { choice: 'athletics' } }), packItem('lowTech', { system: { choice: 'brawn' } })]);
    expect(await ruleDownshiftCancel(hero, 0, { rolledSkill: 'athletics' })).toBe(0);
    expect(await ruleDownshiftCancel(hero, 2, { rolledSkill: 'culture' })).toBe(2);
    expect(await ruleDownshiftCancel(hero, 2, { rolledSkill: 'athletics' })).toBe(1);
    expect(await ruleDownshiftCancel(hero, 2, { rolledSkill: 'brawn' })).toBe(2);
    global.game.combat.turn = 1;
    expect(await ruleDownshiftCancel(hero, 1, { rolledSkill: 'brawn' })).toBe(0);
  });
});

/* -------------------------------------------- */
/*  The damage Role Points box                   */
/* -------------------------------------------- */

describe('the damage Role Points box (Quiet as the Grave, Debilitating Strike, Hard Hitter)', () => {
  const SNEAK = 'Compendium.essence20.gi_joe_crb.Item.Mrmbqza0XxVpKj6U';
  const withBaseRolePoints = (actor, points) => {
    actor._getBaseRolePoints = () => points;
    return actor;
  };

  test('Quiet as the Grave: offered on an attack while the base Role Points are Sneak Attack Damage; ticked, the Sneak Attack damage bonus x2, once per round', async () => {
    const sneak = makeItem({ name: 'Sneak Attack Damage', type: 'rolePoints', flags: { core: { sourceId: SNEAK } }, system: { isActivatable: false, bonus: { type: 'damageBonus', value: 3 } } });
    const infiltrator = withBaseRolePoints(makeActor([packItem('quietAsTheGrave'), sneak]), sneak);
    const knife = effect(infiltrator);
    expect(switchNamed(infiltrator, { item: knife, isAttack: true }, 'Quiet as the Grave')).toBeTruthy();
    expect(switchNamed(withBaseRolePoints(makeActor([packItem('quietAsTheGrave')]), null), { item: knife, isAttack: true }, 'Quiet as the Grave')).toBeUndefined();
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const options = await tick(infiltrator, { item: knife, isAttack: true }, 'Quiet as the Grave');
    expect([options.ruleSneakAttackMultiplier, options.ruleSneakAttackSource]).toEqual([2, 'Quiet as the Grave (double the Sneak Attack damage bonus)']);
    expect(switchNamed(infiltrator, { item: knife, isAttack: true }, 'Quiet as the Grave')).toBeUndefined();
  });

  test('Debilitating Strike: a hit whose roll applied Sneak Attack Damage banks a Snag on the target (not its Initiative)', async () => {
    const infiltrator = makeActor([packItem('debilitating')]);
    const knife = effect(infiltrator);
    const foe = target('Foe');
    await hit(infiltrator, foe, knife);
    expect(bankedSources(foe, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    await hit(infiltrator, foe, knife, { extra: { dataset: { sneakAttackDamage: true } } });
    expect(bankedSources(foe, null, { rolledSkill: 'initiative', dataset: { isInitiative: true } }).sources.some(source => source.snag)).toBe(false);
    expect(bankedSources(foe, null, { rolledSkill: 'athletics' }).sources.some(source => source.snag)).toBe(true);
  });

  test("Hard Hitter: Edge once the dialog closes with its own damage box ticked; another item's box, or unticked, no", () => {
    const hardHitter = packItem('hardHitter');
    const brute = withBaseRolePoints(makeActor([hardHitter]), hardHitter);
    const claw = effect(brute);
    const after = dialog => {
      const options = { edge: false, snag: false, shiftUp: 0, shiftDown: 0, ...dialog };
      applyRuleImmunity(brute, options, roll(claw));
      return options.edge;
    };

    expect([after({ applyRolePointsDamage: true }), after({})]).toEqual([true, false]);
    const other = makeItem({ name: 'Power Strike', type: 'rolePoints', system: {} });
    withBaseRolePoints(brute, other);
    expect(after({ applyRolePointsDamage: true })).toBe(false);
    expect(ruleRollSources(brute, null, roll(claw)).sources.some(source => source.edge)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Range facts, elevation, immunity kinds       */
/* -------------------------------------------- */

const { ruleImmunities } = await import('./plugins/rolls/immunity-kinds.mjs');
const { ruleWeaponRange } = await import('./plugins/tags/range-facts.mjs');
const { diceChecks } = await import('./plugins/tags/dice-checks.mjs');

describe('ranged attack facts (roll:rangeBand, roll:elevationAbove:, WeaponRange) and the new immunity kinds', () => {
  const rangedRoll = (item, facts) => ({ ...roll(item), isMelee: false, dataset: facts ? { rangeFacts: facts } : {} });
  const weaponOf = (actor, { traits = [], source = null } = {}) => {
    const gun = makeItem({ name: 'Gun', type: 'weapon', flags: { core: source ? { sourceId: source } : {} }, system: { traits, equipped: true } });
    gun.parent = actor;
    actor.items.contents.push(gun);
    return effect(actor, { parentId: gun.id, style: 'projectile', skill: 'targeting' });
  };

  const edgeOf = (actor, target, rolled) => ruleRollSources(actor, target, rolled).sources;

  test('Ballistics Precision: ↑1 with a Ballistic weapon at normal Range only; nothing without distance facts', () => {
    const shooter = makeActor([packItem('ballisticsPrecision')]);
    const rifle = weaponOf(shooter, { traits: ['ballistic'] });
    const bow = weaponOf(shooter);
    const up = rolled => edgeOf(shooter, null, rolled).reduce((sum, source) => sum + source.shiftUp, 0);
    expect(up(rangedRoll(rifle, { distance: 20, normalRange: 20, longRange: 80 }))).toBe(1);
    expect(up(rangedRoll(rifle, { distance: 50, normalRange: 20, longRange: 80 }))).toBe(0);
    expect(up(rangedRoll(bow, { distance: 20, normalRange: 20, longRange: 80 }))).toBe(0);
    expect(up(rangedRoll(rifle, null))).toBe(0);
    expect(switchesOf(shooter, rangedRoll(rifle, null))).toEqual([]);
  });

  test('Vantage Point: Edge 30 ft or more above the target, or from the appraised area; As Above any height; So Below ↓1 on the attacker', () => {
    const raider = makeActor([packItem('vantagePoint')]);
    const gun = weaponOf(raider);
    const foe = target('Foe');
    const edge = (actor, rolled, other = foe) => edgeOf(actor, other, rolled).some(source => source.edge);
    expect(edge(raider, rangedRoll(gun, { distance: 20, normalRange: 20, elevation: 30 }))).toBe(true);
    expect(edge(raider, rangedRoll(gun, { distance: 20, normalRange: 20, elevation: 29 }))).toBe(false);
    diceChecks.isInAppraisedArea = (attacker, other) => other === foe;
    expect(edge(raider, rangedRoll(gun, { distance: 20, normalRange: 20, elevation: 0 }))).toBe(true);
    diceChecks.isInAppraisedArea = null;
    const strafer = makeActor([packItem('asAbove')]);
    const shot = weaponOf(strafer);
    expect([edge(strafer, rangedRoll(shot, { elevation: 5 })), edge(strafer, rangedRoll(shot, { elevation: 0 }))]).toEqual([true, false]);
    const holder = target('Holder');
    holder.items.contents.push(Object.assign(packItem('soBelow'), { parent: holder }));
    rebuildIndex(holder);
    const down = (rolled) => edgeOf(makeActor([]), holder, rolled).reduce((sum, source) => sum + source.shiftDown, 0);
    expect([down(rangedRoll(shot, { elevation: 5 })), down(rangedRoll(shot, { elevation: -5 }))]).toEqual([1, 0]);
  });

  test('Trajectory: +30 ft to a targeting explosive attack\'s ranges; nothing for another attack', () => {
    const artillery = makeActor([packItem('trajectory')]);
    const mortar = effect(artillery, { style: 'explosive', skill: 'targeting' });
    const grenade = effect(artillery, { style: 'explosive', skill: 'might' });
    expect([ruleWeaponRange(artillery, roll(mortar)), ruleWeaponRange(artillery, roll(grenade))]).toEqual([30, 0]);
  });

  test('Menace (shotgun / SMG) and CQB Training lift the Reach ↓; Nowhere to Run carries longRangeSnagForEdge', () => {
    const SHOTGUN = 'Compendium.essence20.gi_joe_crb.Item.2qW1YLopvjKyezNQ';
    const kicker = makeActor([packItem('menace')]);
    const shotgun = weaponOf(kicker, { source: SHOTGUN });
    const pistol = weaponOf(kicker);
    expect(ruleImmunities(kicker, null, rangedRoll(shotgun), 'reachDownshift').length).toBe(1);
    expect(ruleImmunities(kicker, null, rangedRoll(pistol), 'reachDownshift').length).toBe(0);
    const trained = makeActor([packItem('cqb')]);
    expect(ruleImmunities(trained, null, rangedRoll(weaponOf(trained)), 'reachDownshift').length).toBe(1);
    expect(ruleImmunities(trained, null, roll(effect(trained)), 'reachDownshift').length).toBe(0);
    const gunner = makeActor([packItem('nowhereToRun')]);
    const [entry] = ruleImmunities(gunner, null, rangedRoll(weaponOf(gunner)), 'longRangeSnagForEdge');
    expect(entry.item.name).toBe('Nowhere to Run');
  });
});

/* -------------------------------------------- */
/*  Attack checks against the target             */
/* -------------------------------------------- */

const { targetTagHelpers } = await import('./plugins/tags/dice-target-tags.mjs');
const { ruleSizeMatrixSteps } = await import('./plugins/combat/size-matrix-steps.mjs');

describe("attack checks (Worst Nightmare, Gang Up, Team Focus, Withering Fire, Sadistic, Heavy Ordnance, Evolved Instincts...)", () => {
  const shifts = (actor, target, rolled) => {
    const sources = ruleRollSources(actor, target, rolled).sources;
    return { up: sources.reduce((s, x) => s + x.shiftUp, 0), down: sources.reduce((s, x) => s + x.shiftDown, 0), edge: sources.some(x => x.edge), specialize: false };
  };

  test('Worst Nightmare: ↑1 against a Frightened target, or Edge instead when this actor caused it', () => {
    const joe = makeActor([packItem('worstNightmare')]);
    const knife = effect(joe);
    const scared = target('Scared', { statuses: ['frightened'] });
    expect(shifts(joe, scared, roll(knife))).toEqual(expect.objectContaining({ up: 1, edge: false }));
    scared.effects = [{ statuses: new Set(['frightened']), flags: { essence20: { conditionSource: joe.uuid } } }];
    expect(shifts(joe, scared, roll(knife))).toEqual(expect.objectContaining({ up: 0, edge: true }));
    expect(shifts(joe, target('Calm'), roll(knife))).toEqual(expect.objectContaining({ up: 0, edge: false }));
  });

  test("Gang Up: its Role Points' bonus when another token within 5 ft of the target holds Let's Go Psycho! (not the attacker)", () => {
    const LGP = 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.qMvUP1yEtsSo6KDh';
    const psycho = makeActor([packItem('gangUp', { system: { bonus: { type: 'attackUpshift', value: 2 } } })]);
    const claw = effect(psycho);
    const foe = target('Foe');
    const buddy = makeActor([makeItem({ name: "Let's Go Psycho!", type: 'perk', flags: { core: { sourceId: LGP } } })]);
    const self = makeActor([makeItem({ name: "Let's Go Psycho!", type: 'perk', flags: { core: { sourceId: LGP } } })]);
    targetTagHelpers.getAllNearbyTokens = () => [{ actor: buddy }];
    expect(shifts(psycho, foe, roll(claw)).up).toBe(2);
    targetTagHelpers.getAllNearbyTokens = () => [{ actor: psycho }, { actor: target('Nobody') }];
    expect(shifts(psycho, foe, roll(claw)).up).toBe(0);
    targetTagHelpers.getAllNearbyTokens = null;
    expect(self).toBeTruthy();
  });

  test("Team Focus (↑ its advances, melee) and Withering Fire (1 Story Point switch, Frightened on a hit) read check:attackedByAlly", async () => {
    diceChecks.attackedByAllyThisRound = (actor, other) => other.name == 'Hit';
    const ranger = makeActor([packItem('teamFocus', { system: { advances: { currentValue: 2 } } }), packItem('witheringFire')]);
    const sword = effect(ranger);
    const gun = effect(ranger, { style: 'projectile' });
    const hitBefore = target('Hit');
    expect(shifts(ranger, hitBefore, roll(sword)).up).toBe(2);
    expect(shifts(ranger, hitBefore, roll(gun)).up).toBe(0);
    expect(shifts(ranger, target('Fresh'), roll(sword)).up).toBe(0);
    setTargets([hitBefore]);
    expect(switchNamed(ranger, roll(gun), 'Withering Fire')).toBeTruthy();
    setTargets([target('Fresh')]);
    expect(switchNamed(ranger, roll(gun), 'Withering Fire')).toBeUndefined();
    setTargets([hitBefore]);
    await tick(ranger, roll(gun), 'Withering Fire');
    expect(storyPoints.spent).toEqual([{ name: 'Hero', amount: 1 }]);
    await hit(ranger, hitBefore, gun, { extra: { switches: ['witheringFire'] } });
    expect(conditions).toEqual([{ name: 'Hit', status: 'frightened', rounds: 0 }]);
    diceChecks.attackedByAllyThisRound = null;
  });

  test('Sadistic: ↓1 unless the target has at least as many Conditions as any enemy in the scene', () => {
    const brute = makeActor([packItem('sadistic')]);
    const club = effect(brute);
    const worst = target('Worst', { statuses: ['prone', 'impaired'] });
    const lesser = target('Lesser', { statuses: ['prone'] });
    targetTagHelpers.getNearbyEnemyTokens = () => [{ actor: worst }, { actor: lesser }];
    expect([shifts(brute, worst, roll(club)).down, shifts(brute, lesser, roll(club)).down]).toEqual([0, 1]);
    targetTagHelpers.getNearbyEnemyTokens = null;
  });

  test("Genius: Specialized on a Role Skill; Deep Wisdom: Edge for a Zord against a Resistance / Immunity to the attack's type", () => {
    const tech = makeActor([packItem('genius')]);
    tech._getBaseRole = () => ({ system: { skills: ['technology'] } });
    const spec = skill => rollRules(tech, null, { rolledSkill: skill }).some(entry => entry.rule.specialize && entry.answer === true);
    expect([spec('technology'), spec('culture')]).toEqual([true, false]);
    const zord = makeActor([packItem('deepWisdom')], { type: 'zord' });
    const fist = effect(zord, { damageType: 'fire' });
    expect(shifts(zord, target('Wet', { system: { resistances: { fire: true } } }), roll(fist)).edge).toBe(true);
    expect(shifts(zord, target('Dry'), roll(fist)).edge).toBe(false);
    const ranger = makeActor([packItem('deepWisdom')]);
    expect(shifts(ranger, target('Wet', { system: { resistances: { fire: true } } }), roll(effect(ranger, { damageType: 'fire' }))).edge).toBe(false);
  });

  test('When Push Comes To Shove: one ladder step on a grapple; Jacket Wrestler lifts the grapple Size ↓', () => {
    const charger = makeActor([packItem('whenPush'), packItem('jacketWrestler')]);
    const grab = effect(charger, { damageType: 'grapple' });
    const punch = effect(charger);
    expect([ruleSizeMatrixSteps(charger, null, roll(grab)), ruleSizeMatrixSteps(charger, null, roll(punch))]).toEqual([1, 0]);
    expect(ruleImmunities(charger, null, roll(grab), 'grappleSizeDownshift').length).toBe(1);
    expect(ruleDieSubstitution(charger, { ...roll(grab), rolledSkill: 'might' })).toBeTruthy();
  });

  test('Maximize Flaws: the Use (in combat, 1 Personal Power) marks the target this turn; then no Resistance Snag, or an Edge when it resists nothing', async () => {
    const thorn = packItem('maximizeFlaws');
    const psycho = makeActor([thorn]);
    const foe = target('Foe');
    setTargets([foe]);
    await use(thorn);
    expect(psycho.system.powers.personal.value).toBe(3);
    const turns = [{ actor: psycho }];
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns, combatants: turns };
    await use(thorn);
    expect(psycho.system.powers.personal.value).toBe(2);
    const spike = effect(psycho);
    expect(ruleImmunities(psycho, foe, roll(spike), 'resistanceSnag').length).toBe(1);
    expect(shifts(psycho, foe, { ...roll(spike), dataset: { targetResists: false } }).edge).toBe(true);
    expect(shifts(psycho, foe, { ...roll(spike), dataset: { targetResists: true } }).edge).toBe(false);
    expect(ruleImmunities(psycho, target('Other'), roll(spike), 'resistanceSnag').length).toBe(0);
  });
});

/* -------------------------------------------- */
/*  The Skill die (die-facts.mjs)                */
/* -------------------------------------------- */

const { ruleDownshiftCap, ruleFumbleUpTo } = await import('./plugins/rolls/die-facts.mjs');

describe('the Skill die: Jack Of All Trades, Time Traveler, Advantageous Fighter, Programmable', () => {
  test('Jack Of All Trades: offered on a d2 Skill only; ticked, ↑1 and no Critical Success', async () => {
    const agent = makeActor([packItem('jackOfAllTrades')]);
    expect(switchNamed(agent, { rolledSkill: 'culture', baseShift: 'd4' }, 'Jack Of All Trades')).toBeUndefined();
    const options = await tick(agent, { rolledSkill: 'culture', baseShift: 'd2' }, 'Jack Of All Trades');
    expect([options.shiftUp, options.suppressCrit]).toEqual([1, true]);
  });

  test("Time Traveler's Hang-Up: a natural 2 Fumbles on a d4 or lower; Advantageous Fighter: ↓ at most 2 on a melee attack with Edge", () => {
    const traveler = makeActor([packItem('timeTraveler')]);
    expect([ruleFumbleUpTo(traveler, { finalShift: 'd4' }), ruleFumbleUpTo(traveler, { finalShift: 'd2' }), ruleFumbleUpTo(traveler, { finalShift: 'd6' })]).toEqual([2, 2, 1]);
    expect(ruleFumbleUpTo(makeActor([]), { finalShift: 'd2' })).toBe(1);
    const fighter = makeActor([packItem('advantageous')]);
    const sword = effect(fighter);
    const gun = effect(fighter, { style: 'projectile' });
    expect([ruleDownshiftCap(fighter, { ...roll(sword), edge: true }), ruleDownshiftCap(fighter, { ...roll(sword), edge: false }), ruleDownshiftCap(fighter, { ...roll(gun), edge: true })]).toEqual([2, null, null]);
  });

  test('Programmable: a 0-3 box of ↑, and the d12 cap only when some was spent', async () => {
    const android = makeActor([packItem('programmable')]);
    const box = switchNamed(android, { rolledSkill: 'athletics' }, 'Programmable');
    expect([box.type, box.max]).toEqual(['number', 3]);
    const spent = await tick(android, { rolledSkill: 'athletics' }, 'Programmable', 2);
    expect([spent.shiftUp, spent.ruleCapDie]).toEqual([2, 'd12']);
    const none = await tick(android, { rolledSkill: 'athletics' }, 'Programmable', 0);
    expect([none.shiftUp, none.ruleCapDie]).toEqual([0, undefined]);
  });
});

describe('Bad Temper / Something To Prove: a Fumble in a combat gives ↓1 for the whole next round only', () => {
  test.each([['badTemper', 'Bad Temper'], ['somethingToProve', 'Something To Prove']])('%s', async (key, label) => {
    const traitor = makeActor([packItem(key)]);
    const down = () => ruleRollSources(traitor, null, { rolledSkill: 'athletics' }).sources.filter(source => source.label.startsWith(label)).reduce((s, x) => s + x.shiftDown, 0);
    await afterRoll(traitor, null, { outcome: 'fumble', results: [{ success: false, multiplier: 0 }], extra: { rolledSkill: 'athletics' } });
    expect(markOf(traitor, key)).toBeFalsy();
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: [] };
    await fireTriggers(traitor, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: 'fumble', facts: { results: [{ success: false, multiplier: 0 }], isFumble: true, isCrit: false } });
    expect(down()).toBe(0);
    global.game.combat.round = 3;
    expect(down()).toBe(1);
    global.game.combat.round = 4;
    expect(down()).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Expert in Your Field, Sabotage, ...          */
/* -------------------------------------------- */

const { ruleEdgeOrShift } = await import('./plugins/rolls/edge-or-shift.mjs');
const { diceRefHelpers } = await import('./plugins/tags/dice-refs.mjs');

describe('Expert in Your Field, Sabotage, Different Perspective, Kind But Firm', () => {
  const FIELD = 'Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C';
  const EMPATHY = 'Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ';
  const chosen = (uuid, choice) => makeItem({ name: 'Choice', type: 'perk', flags: { core: { sourceId: uuid } }, system: { choice } });

  test('Expert in Your Field: on the Field Skill only, ↑3 in place of a second Edge', () => {
    const tech = makeActor([packItem('expertInYourField'), chosen(FIELD, 'science')]);
    expect([ruleEdgeOrShift(tech, { rolledSkill: 'science' }), ruleEdgeOrShift(tech, { rolledSkill: 'culture' })]).toEqual([3, null]);
  });

  test('Sabotage: ↑ equal to the Sneak Attack damage on Technology', () => {
    const saboteur = makeActor([packItem('sabotage')]);
    diceRefHelpers.getSneakAttackDamage = () => 3;
    const up = skill => ruleRollSources(saboteur, null, { rolledSkill: skill }).sources.reduce((s, x) => s + x.shiftUp, 0);
    expect([up('technology'), up('science')]).toEqual([3, 0]);
    diceRefHelpers.getSneakAttackDamage = null;
  });

  test('Different Perspective: ↑1 on Smarts / Social while Culture is at least as good as the rolled Skill', () => {
    const outsider = makeActor([packItem('differentPerspective')], { system: { skills: { culture: { shift: 'd6' }, persuasion: { shift: 'd6' }, science: { shift: 'd8' }, deception: { shift: 'd4' } } } });
    const up = (skill, essence) => ruleRollSources(outsider, null, { rolledSkill: skill, rolledEssence: essence }).sources.reduce((s, x) => s + x.shiftUp, 0);
    expect([up('persuasion', 'social'), up('science', 'smarts'), up('deception', 'social'), up('athletics', 'strength')]).toEqual([1, 0, 1, 0]);
  });

  test("Kind, But Firm: on Intimidation, roll the Empathy Skill's die instead (offered only with an Empathy choice)", async () => {
    const pony = makeActor([packItem('kindButFirm'), chosen(EMPATHY, 'persuasion')], { system: { skills: { intimidation: { shift: 'd4' }, persuasion: { shift: 'd8' } } } });
    const options = await tick(pony, { rolledSkill: 'intimidation', baseShift: 'd4' }, 'Kind, But Firm');
    expect(options.shiftUp).toBe(2);
    expect(switchNamed(pony, { rolledSkill: 'persuasion' }, 'Kind, But Firm')).toBeUndefined();
    expect(switchNamed(makeActor([packItem('kindButFirm')], { system: { skills: { intimidation: { shift: 'd4' } } } }), { rolledSkill: 'intimidation' }, 'Kind, But Firm')).toBeUndefined();
  });
});

describe('Rolling Thunder: Burly in or out of a vehicle, +1 per Size Class the bigger of you and your vehicle beats the target', () => {
  test('in a Huge vehicle against a common target: ↑1 + 3; out of a vehicle, or no target: ↑1; medium armor: nothing', () => {
    const marauder = makeActor([packItem('rollingThunder')], { name: 'Marauder' });
    const up = ctx => ruleRollSources(marauder, ctx.target ?? null, { rolledSkill: 'intimidation' }).sources.reduce((s, x) => s + x.shiftUp, 0);
    setTargets([]);
    expect(up({})).toBe(1);
    const truck = makeActor([], { name: 'Truck', type: 'vehicle', system: { size: 'huge', actors: { crew1: { vehicleRole: 'driver', uuid: marauder.uuid } } } });
    expect(up({})).toBe(1);
    const foe = target('Foe');
    setTargets([foe]);
    expect(up({ target: foe })).toBe(4);
    expect(truck).toBeTruthy();
  });
});

describe('Rumble in the Jungle: the Intimidation die joins the pool against a target yet to act, with a weapon that is not Silent', () => {
  test('BonusPoolDie', async () => {
    const { ruleBonusPoolDie } = await import('./plugins/rolls/die-facts.mjs');
    const slaughter = makeActor([packItem('rumble')], { system: { skills: { intimidation: { shift: 'd8' } } } });
    const fist = effect(slaughter);
    const early = target('Early');
    const late = target('Late');
    const turns = [{ actor: early }, { actor: slaughter }, { actor: late }];
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 1, turns, combatants: turns };
    expect([ruleBonusPoolDie(slaughter, roll(fist), late), ruleBonusPoolDie(slaughter, roll(fist), early)]).toEqual(['d8', null]);
    const quiet = makeItem({ name: 'Knife', type: 'weapon', system: { traits: ['silent'], equipped: true } });
    quiet.parent = slaughter;
    slaughter.items.contents.push(quiet);
    expect(ruleBonusPoolDie(slaughter, roll(effect(slaughter, { parentId: quiet.id })), late)).toBe(null);
    slaughter.system.skills.intimidation.shift = 'd20';
    expect(ruleBonusPoolDie(slaughter, roll(fist), late)).toBe(null);
  });
});

describe('Imaginative Engineering: the first Energon spend each round gives one more ↑', () => {
  test('EnergonSpendBonus, once per round', async () => {
    const { ruleEnergonSpendBonus } = await import('./plugins/rolls/energon-spend-bonus.mjs');
    const scientist = makeActor([packItem('imaginative')]);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    expect(await ruleEnergonSpendBonus(scientist, { rolledSkill: 'science' })).toBe(1);
    expect(await ruleEnergonSpendBonus(scientist, { rolledSkill: 'science' })).toBe(0);
    global.game.combat.round = 2;
    expect(await ruleEnergonSpendBonus(scientist, { rolledSkill: 'science' })).toBe(1);
    expect(await ruleEnergonSpendBonus(makeActor([]), { rolledSkill: 'science' })).toBe(0);
  });
});

describe('Worth A Shot / Worth Another Shot: roll Targeting instead, as if Specialized, with a Ballistic weapon owned', () => {
  const gunner = (items, skills = { targeting: { shift: 'd10' }, athletics: { shift: 'd6' } }) => {
    const actor = makeActor(items, { system: { skills } });
    const gun = makeItem({ name: 'Rifle', type: 'weapon', system: { traits: ['ballistic'] } });
    gun.parent = actor;
    actor.items.contents.push(gun);
    rebuildIndex(actor);
    return actor;
  };

  test('outside combat: once per scene (twice with Worth Another Shot); the swap is ↑ by the dice difference', async () => {
    global.game.combat = null;
    const one = gunner([packItem('worthAShot')]);
    const options = await tick(one, { rolledSkill: 'athletics', baseShift: 'd6' }, 'Worth A Shot');
    expect([options.shiftUp, options.isSpecialized]).toEqual([2, true]);
    expect(switchNamed(one, { rolledSkill: 'athletics' }, 'Worth A Shot')).toBeUndefined();
    const two = gunner([packItem('worthAShot'), packItem('worthAnotherShot')]);
    await tick(two, { rolledSkill: 'athletics', baseShift: 'd6' }, 'Worth A Shot');
    expect(switchNamed(two, { rolledSkill: 'athletics' }, 'Worth A Shot')).toBeTruthy();
    expect(switchNamed(two, { rolledSkill: 'athletics' }, 'Worth Another Shot')).toBeUndefined();
    expect(switchNamed(makeActor([packItem('worthAShot')], { system: { skills: { targeting: { shift: 'd10' }, athletics: { shift: 'd6' } } } }), { rolledSkill: 'athletics' }, 'Worth A Shot')).toBeUndefined();
  });

  test('in combat: only with Worth Another Shot, once per encounter', async () => {
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    expect(switchNamed(gunner([packItem('worthAShot')]), { rolledSkill: 'athletics' }, 'Worth')).toBeUndefined();
    const two = gunner([packItem('worthAShot'), packItem('worthAnotherShot')]);
    expect(switchNamed(two, { rolledSkill: 'athletics' }, 'Worth A Shot')).toBeUndefined();
    const options = await tick(two, { rolledSkill: 'athletics', baseShift: 'd6' }, 'Worth Another Shot');
    expect([options.shiftUp, options.isSpecialized]).toEqual([2, true]);
    expect(switchNamed(two, { rolledSkill: 'athletics' }, 'Worth Another Shot')).toBeUndefined();
    expect(switchNamed(gunner([packItem('worthAnotherShot')]), { rolledSkill: 'athletics' }, 'Worth')).toBeUndefined();
  });
});

describe('"Friendly" Fire: a Spoofed Initiative readies an Edge on the first attack that combat', () => {
  test('mark on initiativeRolling with the spoof switch, used up by an attack', async () => {
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const spy = makeActor([packItem('friendlyFire')]);
    await fireTriggers(spy, 'initiativeRolling', { roll: { switches: [] } });
    const strike = effect(spy);
    const edgeOf = () => rollRules(spy, null, roll(strike)).some(entry => entry.rule.edge && entry.answer === true);
    expect(edgeOf()).toBe(false);
    await fireTriggers(spy, 'initiativeRolling', { roll: { switches: ['spoof'] } });
    expect(markOf(spy, 'friendlyFire')).toBeTruthy();
    expect(edgeOf()).toBe(true);
    expect(rollRules(spy, null, { rolledSkill: 'athletics' }).some(entry => entry.rule.edge && entry.answer === true)).toBe(false);
  });
});

describe('Beloved: ↑1 or remove the Snag, one Skill Test per turn', () => {
  test('two switches sharing one per-turn use', async () => {
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const romantic = makeActor([packItem('beloved')]);
    const up = await tick(romantic, { rolledSkill: 'persuasion' }, 'Beloved (↑1');
    expect(up.shiftUp).toBe(1);
    expect(switchNamed(romantic, { rolledSkill: 'persuasion' }, 'Beloved')).toBeUndefined();
    global.game.combat.turn = 1;
    const clear = await tick(romantic, { rolledSkill: 'persuasion' }, 'Beloved (remove Snag', true, { snag: true });
    expect([clear.snag, clear.shiftUp]).toEqual([false, 0]);
    expect(switchNamed(romantic, { rolledSkill: 'persuasion' }, 'Beloved')).toBeUndefined();
  });
});

describe('Fast Draw / Anti-Air Combat Training: the attacker over the Defense an attack targets', () => {
  test('Fast Draw: a switch on attacks; ticked, Evasion becomes Toughness', async () => {
    const { ruleDefenseSwap } = await import('./plugins/combat/defense-swap.mjs');
    const bot = makeActor([packItem('fastDraw')]);
    const gun = effect(bot, { style: 'ranged', skill: 'targeting' });
    expect(switchNamed(bot, roll(gun), 'Fast Draw')).toBeTruthy();
    expect(switchNamed(bot, { rolledSkill: 'athletics' }, 'Fast Draw')).toBeUndefined();
    const options = await tick(bot, roll(gun), 'Fast Draw');
    const foe = target('Foe');
    const swap = (defense, switches) => ruleDefenseSwap(bot, foe, { item: gun, switches }, defense);
    expect([swap('evasion', options.ruleKeys), swap('willpower', options.ruleKeys), swap('evasion', [])]).toEqual(['toughness', 'willpower', 'evasion']);
  });

  test('Anti-Air Combat Training: immune to evasiveManeuvers on attacks', async () => {
    const { ruleImmunities } = await import('./plugins/rolls/immunity-kinds.mjs');
    const gunner = makeActor([packItem('antiAir')]);
    const gun = effect(gunner, { style: 'ranged', skill: 'targeting' });
    expect(ruleImmunities(gunner, target('Jet'), roll(gun), 'evasiveManeuvers').length).toBe(1);
    expect(ruleImmunities(gunner, target('Jet'), { rolledSkill: 'athletics' }, 'evasiveManeuvers').length).toBe(0);
  });
});

describe('Size Matters: trade ↑ for damage on a ranged attack against something larger', () => {
  test('1 per ↑ against a larger vehicle, 1 per ↑2 against a larger creature, never more than the roll has', async () => {
    const { tradeRuleUpshifts } = await import('./plugins/rolls/upshift-trade.mjs');
    const siege = makeActor([packItem('sizeMatters')]);
    const gun = effect(siege, { style: 'ranged', skill: 'targeting' });
    const tank = target('Tank', { type: 'vehicle', system: { size: 'huge' } });
    const giant = target('Giant', { system: { size: 'huge' } });
    const peer = target('Peer', { system: { size: 'common' } });
    const trade = (who, asked, shiftUp, label) => {
      setTargets([who]);
      const entry = switchNamed(siege, roll(gun), label);
      const options = { shiftUp, ext: entry ? { [entry.name]: asked } : {} };
      return [tradeRuleUpshifts(siege, options, roll(gun)).damage, options.shiftUp];
    };

    expect(trade(tank, 2, 3, 'Size Matters (trade ↑ for')).toEqual([2, 1]);
    expect(trade(tank, 5, 3, 'Size Matters (trade ↑ for')).toEqual([3, 0]);
    expect(trade(giant, 3, 3, 'Size Matters (trade ↑2')).toEqual([1, 0]);
    expect(trade(peer, 2, 3, 'Size Matters')).toEqual([0, 3]);
    setTargets([tank]);
    expect(switchNamed(siege, roll(effect(siege)), 'Size Matters')).toBeUndefined();
    expect(switchNamed(siege, roll(gun), 'Size Matters (trade ↑2')).toBeUndefined();
    setTargets([]);
  });
});

describe('Disarming Shot / Double Agent: declared in the dialog', () => {
  test('Disarming Shot: ↓3 on a ranged attack only', async () => {
    const sniper = makeActor([packItem('disarmingShot')]);
    const gun = effect(sniper, { style: 'ranged', skill: 'targeting' });
    expect((await tick(sniper, roll(gun), 'Disarming Shot')).shiftDown).toBe(3);
    expect(switchNamed(sniper, roll(effect(sniper)), 'Disarming Shot')).toBeUndefined();
  });

  // Audit fix 2026-10-07: the ticked switch must also turn on target-riders.mjs's disarm-on-hit / Critical discharge
  // (it read options.applyDisarmingShot, which nothing set once the switch became a rule).
  test('Disarming Shot: the ticked switch (key disarmingShot) turns on the rider context\'s disarm; unticked, it stays off', async () => {
    const { buildRiderContext } = await import('../mechanics/combat/target-riders.mjs');
    const sniper = makeActor([packItem('disarmingShot')]);
    const gun = effect(sniper, { style: 'ranged', skill: 'targeting' });
    const ticked = await tick(sniper, roll(gun), 'Disarming Shot');
    expect(ticked.ruleKeys).toContain('disarmingShot');
    expect(buildRiderContext(sniper, gun, {}, ticked).disarmingShot).toBe(true);
    const unticked = await tick(sniper, roll(gun), 'Disarming Shot', false);
    expect(buildRiderContext(sniper, gun, {}, unticked).disarmingShot).toBe(false);
  });

  test('Double Agent: ↑1 on Smarts / Social; on an attack, -1 to the target Defense', async () => {
    const mole = makeActor([packItem('doubleAgent')]);
    expect((await tick(mole, { rolledSkill: 'deception', rolledEssence: 'social' }, 'Double Agent (↑1')).shiftUp).toBe(1);
    expect(switchNamed(mole, { rolledSkill: 'athletics', rolledEssence: 'strength' }, 'Double Agent')).toBeUndefined();
    const gun = effect(mole, { style: 'ranged', skill: 'targeting' });
    expect(switchNamed(mole, roll(gun, { rolledEssence: 'speed' }), 'Double Agent (↑1')).toBeUndefined();
    const options = await tick(mole, roll(gun, { rolledEssence: 'speed' }), 'Double Agent (-1');
    const foe = target('Foe');
    expect(ruleDefenseAdjust(mole, foe, 'evasion', { item: gun, difficulty: 12, switches: options.ruleKeys })).toBe(-1);
    expect(ruleDefenseAdjust(mole, foe, 'evasion', { item: gun, difficulty: 12, switches: [] })).toBe(0);
  });
});

describe('Quantum Cut / Drilling Shot: the target Defense without its armor', () => {
  const weaponFrom = (actor, id) => {
    const weapon = makeItem({ name: 'Weapon', type: 'weapon', system: { equipped: true }, flags: { core: { sourceId: `Compendium.essence20.x.Item.${id}` } } });
    weapon.parent = actor;
    actor.items.contents.push(weapon);
    return effect(actor, { parentId: weapon.id, style: 'melee' });
  };

  test('Quantum Cut: a paid switch with the Quantum Defender sword; ticked, Toughness without armor', async () => {
    const { ruleDefenseSwap } = await import('./plugins/combat/defense-swap.mjs');
    const { ruleNoArmor } = await import('./plugins/combat/no-armor-defense.mjs');
    const ranger = makeActor([packItem('quantumCut')]);
    const sword = weaponFrom(ranger, 'HNgu1rhXK46RG0bW');
    expect(switchNamed(ranger, roll(effect(ranger)), 'Quantum Cut')).toBeUndefined();
    const options = await tick(ranger, roll(sword), 'Quantum Cut');
    expect(ranger.system.powers.personal.value).toBe(2);
    const foe = target('Foe');
    const ctx = { item: sword, switches: options.ruleKeys };
    expect([ruleDefenseSwap(ranger, foe, ctx, 'evasion'), ruleDefenseSwap(ranger, foe, ctx, 'willpower')]).toEqual(['toughness', 'toughness']);
    expect(ruleNoArmor(ranger, foe, 'toughness', ctx)).toBe(true);
    expect(ruleNoArmor(ranger, foe, 'toughness', { item: sword, switches: [] })).toBe(false);
    ranger.system.powers.personal.value = 0;
    expect(switchNamed(ranger, roll(sword), 'Quantum Cut')).toBeUndefined();
  });

  test('Drilling Shot: always with the Long Range Rifle', async () => {
    const { ruleNoArmor } = await import('./plugins/combat/no-armor-defense.mjs');
    const sniper = makeActor([packItem('drillingShot')]);
    const rifle = weaponFrom(sniper, '8Hi76APCo9QRnbLE');
    const foe = target('Foe');
    expect([ruleNoArmor(sniper, foe, 'evasion', { item: rifle }), ruleNoArmor(sniper, foe, 'toughness', { item: effect(sniper) })]).toEqual([true, false]);
  });
});

describe('Penetrating Aim: a ranged switch that ignores 1 point of the target Toughness armor bonus', () => {
  test('ignoreArmor points: 1, capped at the armor share', async () => {
    const { ignoreArmorAdjust } = await import('./plugins/combat/ignore-armor.mjs');
    const raider = makeActor([packItem('penetratingAim')]);
    const gun = effect(raider, { style: 'ranged', skill: 'targeting' });
    expect(switchNamed(raider, roll(effect(raider)), 'Penetrating Aim')).toBeUndefined();
    const options = await tick(raider, roll(gun), 'Penetrating Aim');
    const armored = target('Armored', { system: { defenses: { toughness: { total: 14, armor: 3 }, evasion: { total: 11, armor: 0 } } } });
    const bare = target('Bare', { system: { defenses: { toughness: { total: 10, armor: 0 } } } });
    const ctx = { item: gun, switches: options.ruleKeys };
    expect([ignoreArmorAdjust(raider, armored, 'toughness', ctx), ignoreArmorAdjust(raider, armored, 'evasion', ctx), ignoreArmorAdjust(raider, bare, 'toughness', ctx) + 0]).toEqual([-1, 0, 0]);
    expect(ignoreArmorAdjust(raider, armored, 'toughness', { item: gun, switches: [] })).toBe(0);
  });
});

describe('Glow: a successful cast lights the caster up; spotting them has Edge; the Use puts it out', () => {
  test('afterRoll tokenLight, incoming Edge on Alertness, Use only while lit', async () => {
    const pony = makeActor([packItem('glow')], { name: 'Pony' });
    const spell = pony.items.contents[0];
    const lit = () => !!spell.flags.essence20.lit;
    const edgeFor = skill => ruleRollSources(makeActor([]), pony, { rolledSkill: skill }).sources.some(source => source.edge);
    const lightUse = () => (spell.system.rules ?? []).findIndex(rule => rule.type == 'Use');
    expect([lit(), edgeFor('alertness'), useAvailable(spell, spell.system.rules[lightUse()], lightUse())]).toEqual([false, false, false]);
    await fireTriggers(pony, 'afterRoll', { roll: { item: spell, rolledSkill: 'spellcasting' }, outcome: 'success', facts: { results: [{ success: true, multiplier: 1 }], isCrit: false, isFumble: false } });
    expect([lit(), edgeFor('alertness'), edgeFor('athletics')]).toEqual([true, true, false]);
    await fireTriggers(pony, 'afterRoll', { roll: { item: spell, rolledSkill: 'spellcasting' }, outcome: 'success', facts: { results: [{ success: true, multiplier: 1 }], isCrit: false, isFumble: false } });
    expect(lit()).toBe(true);
    expect(useAvailable(spell, spell.system.rules[lightUse()], lightUse())).toBe(true);
    await use(spell);
    expect([lit(), edgeFor('alertness')]).toEqual([false, false]);
  });
});

describe('Panacea: a successful cast heals the target (or the caster) to full and clears every status', () => {
  test('cureAll on targetOrSelf', async () => {
    const healer = makeActor([packItem('panacea')], { name: 'Healer', system: { health: { max: 10, value: 4, bonus: 0 } }, statuses: ['prone'] });
    const spell = healer.items.contents[0];
    const patient = target('Patient', { statuses: ['stunned', 'defeated'], system: { health: { max: 8, value: 0, bonus: 0 } } });
    const cast = targets => fireTriggers(healer, 'afterRoll', { roll: { item: spell, rolledSkill: 'spellcasting' }, outcome: 'success', targets, facts: { results: [{ success: true, multiplier: 1 }], isCrit: false, isFumble: false } });
    await cast([patient]);
    expect([patient.system.health.value, [...patient.statuses], healer.system.health.value]).toEqual([8, [], 4]);
    await cast([]);
    expect([healer.system.health.value, [...healer.statuses]]).toEqual([10, []]);
  });
});

describe('Immovable Object / Protector\'s Shield: immune to Critical hits', () => {
  test('CritImmune on the holder; as an aura, the Protected Target within 10 ft while the Personal Shield is up', async () => {
    const { ruleCritImmune } = await import('./plugins/combat/crit-immune.mjs');
    const attacker = makeActor([], { name: 'Attacker' });
    expect([ruleCritImmune(makeActor([packItem('immovableObject')]), attacker), ruleCritImmune(makeActor([]), attacker)]).toEqual([true, false]);

    let shieldUp = true;
    try {
      registerCheck('personalShield', () => shieldUp);
    } catch {
      // already registered by another describe
    }

    const guard = makeActor([packItem('protectorsShield')], { name: 'Guard' });
    const ward = makeActor([], { name: 'Ward' });
    const other = makeActor([], { name: 'Other' });
    guard.flags.essence20.protectedTargetUuid = ward.uuid;
    const place = (actor, x) => {
      const token = { actor, center: { x, y: 0 }, document: { disposition: 1 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    global.canvas = { tokens: { placeables: [place(guard, 0), place(ward, 5), place(other, 5)] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    rebuildIndex(guard);
    expect([ruleCritImmune(ward, attacker), ruleCritImmune(other, attacker), ruleCritImmune(guard, attacker)]).toEqual([true, false, false]);
    shieldUp = false;
    expect(ruleCritImmune(ward, attacker)).toBe(false);
    shieldUp = true;
    ward.getActiveTokens()[0].center.x = 15;
    expect(ruleCritImmune(ward, attacker)).toBe(false);
    global.canvas = undefined;
  });
});

describe('Fighting Style: Akimbo, Long Shot and Close Quarters Battle by choice', () => {
  test('one rule per option, gated on system.choice', async () => {
    const { ruleImmunities } = await import('./plugins/rolls/immunity-kinds.mjs');
    const styled = choice => makeActor([packItem('fightingStyle', { system: { choice } })]);
    const akimbo = styled('akimbo');
    const gun = effect(akimbo, { style: 'ranged', skill: 'targeting' });
    expect((await tick(akimbo, roll(gun), 'Akimbo')).shiftUp).toBe(1);
    expect(switchNamed(akimbo, roll(effect(akimbo)), 'Akimbo')).toBeUndefined();
    const longShot = styled('longShot');
    const cqb = styled('closeQuartersBattle');
    const longGun = effect(longShot, { style: 'ranged', skill: 'targeting' });
    const cqbGun = effect(cqb, { style: 'ranged', skill: 'targeting' });
    expect([ruleNoLongRangeSnag(longShot, null, { item: longGun }), ruleNoLongRangeSnag(cqb, null, { item: cqbGun })]).toEqual([true, false]);
    expect([ruleImmunities(cqb, null, roll(cqbGun), 'reachDownshift').length, ruleImmunities(longShot, null, roll(longGun), 'reachDownshift').length]).toEqual([1, 0]);
    expect(switchNamed(cqb, roll(cqbGun), 'Akimbo')).toBeUndefined();
  });
});

describe('Titan Body / Unseen Strike / Penetrating Shot', () => {
  test('Titan Body: a Zord melee attack deals at least 3', async () => {
    const { ruleDamageFloor } = await import('./plugins/combat/damage-floor.mjs');
    const zord = makeActor([packItem('titanBody')], { type: 'zord' });
    expect([ruleDamageFloor(zord, roll(effect(zord))), ruleDamageFloor(zord, roll(effect(zord, { style: 'ranged' })))]).toEqual([3, 0]);
    const ranger = makeActor([packItem('titanBody')]);
    expect(ruleDamageFloor(ranger, roll(effect(ranger)))).toBe(0);
  });

  test('Unseen Strike: Evasion halved on the first attack each turn while the Phantom Suite is on', () => {
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const phantom = makeActor([packItem('unseenStrike')], { flags: { phantomSuiteActive: true } });
    const gun = effect(phantom, { style: 'ranged', skill: 'targeting' });
    const foe = target('Foe');
    expect(ruleDefenseAdjust(phantom, foe, 'toughness', { item: gun, difficulty: 15 })).toBe(0);
    expect(ruleDefenseAdjust(phantom, foe, 'evasion', { item: gun, difficulty: 15 })).toBe(-7);
    expect(ruleDefenseAdjust(phantom, foe, 'evasion', { item: gun, difficulty: 15 })).toBe(0);
    global.game.combat.turn = 1;
    phantom.flags.essence20.phantomSuiteActive = false;
    expect(ruleDefenseAdjust(phantom, foe, 'evasion', { item: gun, difficulty: 15 })).toBe(0);
  });

  test('Penetrating Shot: damage = Volley Shots - 1 on a ranged attack while Volley is active', async () => {
    const pink = makeActor([packItem('penetratingShot')], { flags: { volleyActive: true } });
    const bow = effect(pink, { style: 'ranged', skill: 'targeting' });
    diceRefHelpers.getVolleyShots = () => 3;
    const options = await tick(pink, roll(bow), 'Penetrating Shot');
    expect(options.ruleDamage).toBe(2);
    diceRefHelpers.getVolleyShots = () => 1;
    expect(switchNamed(pink, roll(bow), 'Penetrating Shot')).toBeUndefined();
    diceRefHelpers.getVolleyShots = () => 3;
    pink.flags.essence20.volleyActive = false;
    expect(switchNamed(pink, roll(bow), 'Penetrating Shot')).toBeUndefined();
    diceRefHelpers.getVolleyShots = null;
  });
});

describe('Splinter Defense: a melee hit on the holder costs the attacker Initiative = Hardened Armor, once per attacker per combat', () => {
  test('targeted Trigger: mark + writeInitiative', async () => {
    const gold = makeActor([packItem('splinterDefense')], { name: 'Gold' });
    const brute = target('Brute');
    const combatant = { actor: brute, actorId: brute.id, initiative: 15 };
    combatant.update = jest.fn(async update => Object.assign(combatant, update));
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [combatant], combatants: [combatant] };
    diceRefHelpers.getHardenedArmorBonus = actor => (actor === gold ? 3 : 0);
    const club = effect(brute);
    const hitGold = rolled => fireTriggers(gold, 'targeted', { roll: roll(rolled), outcome: 'success', targets: [brute], facts: { results: [{ success: true, multiplier: 1 }], isCrit: false, isFumble: false } });
    await hitGold(effect(brute, { style: 'ranged' }));
    expect(combatant.initiative).toBe(15);
    await hitGold(club);
    expect(combatant.initiative).toBe(12);
    await hitGold(club);
    expect(combatant.initiative).toBe(12);
    diceRefHelpers.getHardenedArmorBonus = null;
  });
});

describe('Beam Volley: 2 Energy damage of its own, and its cast targets the 3 nearest enemies', () => {
  test('authored damage + PreCast setTargets to: nearestEnemies:3', async () => {
    const { runPreCast } = await import('./plugins/picks/pre-cast.mjs');
    const pony = makeActor([packItem('beamVolley')], { name: 'Pony' });
    const spell = pony.items.contents[0];
    expect([spell.system.damageValue, spell.system.damageType]).toEqual([2, 'element']);
    const tokenOf = (actor, x) => {
      const token = { id: `t-${actor.name}`, actor, center: { x, y: 0 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    tokenOf(pony, 0);
    const foes = [['Far', 50], ['Near', 5], ['Mid', 20], ['Close', 10]].map(([name, x]) => tokenOf(target(name), x));
    const setTargets = jest.fn();
    global.canvas = { tokens: { placeables: foes, setTargets }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    targetTagHelpers.getNearbyEnemyTokens = () => foes;
    expect(await runPreCast(pony, spell)).toBe(true);
    expect(setTargets).toHaveBeenCalledWith(['t-Near', 't-Close', 't-Mid']);
    targetTagHelpers.getNearbyEnemyTokens = null;
    global.canvas = undefined;
  });
});

describe('Voidshield: Void attacks no longer ignore the Zord armor', () => {
  test('incoming immune: voidArmorIgnore', async () => {
    const { ruleImmunities } = await import('./plugins/rolls/immunity-kinds.mjs');
    const zord = makeActor([packItem('voidshield')], { type: 'zord' });
    const attacker = makeActor([]);
    const blast = effect(attacker, { style: 'ranged', damageType: 'void' });
    expect([ruleImmunities(attacker, zord, roll(blast), 'voidArmorIgnore').length, ruleImmunities(attacker, target('Plain'), roll(blast), 'voidArmorIgnore').length]).toEqual([1, 0]);
  });
});

describe('Empty the Mag: a ranged ballistic switch; ticked, every damaging row is doubled at the end', () => {
  test('DialogSwitch key emptyTheMag + HitMultiplier stage late', async () => {
    const { applyLateHitMultipliers, applyCardHitMultipliers } = await import('./plugins/combat/card-hit-multiplier.mjs');
    const vanguard = makeActor([packItem('emptyTheMag')]);
    const rifle = makeItem({ name: 'Rifle', type: 'weapon', system: { traits: ['ballistic'], equipped: true } });
    rifle.parent = vanguard;
    vanguard.items.contents.push(rifle);
    const shot = effect(vanguard, { parentId: rifle.id, style: 'ranged', skill: 'targeting' });
    expect(switchNamed(vanguard, roll(effect(vanguard, { style: 'ranged' })), 'Empty the Mag')).toBeUndefined();
    const options = await tick(vanguard, roll(shot), 'Empty the Mag');
    expect(options.ruleKeys).toEqual(['emptyTheMag']);
    const rows = () => [{ damageValue: 3, targetUuid: null, success: true }, { damageValue: 0, success: false }];
    const on = rows();
    await applyCardHitMultipliers(vanguard, on, { riderContext: { switches: options.ruleKeys } });
    expect(on[0].damageValue).toBe(3);
    await applyLateHitMultipliers(vanguard, on, { riderContext: { switches: options.ruleKeys } });
    expect(on.map(row => row.damageValue)).toEqual([6, 0]);
    const off = rows();
    await applyLateHitMultipliers(vanguard, off, { riderContext: { switches: [] } });
    expect(off[0].damageValue).toBe(3);
  });
});

describe('Pack Mule: a hit marks the target for rounds r..r+2 of that combat; ↓2 on its Strength / Speed tests', () => {
  test('hit Trigger mark until throughRoundPlus2 + marked RollModifier', async () => {
    const caster = makeActor([packItem('packMule')], { name: 'Caster' });
    const spell = caster.items.contents[0];
    const mule = target('Mule');
    const down = (essence) => ruleRollSources(mule, null, { rolledSkill: essence == 'strength' ? 'athletics' : 'finesse', rolledEssence: essence }).sources.reduce((sum, source) => sum + (source.shiftDown || 0), 0);
    global.game.combat = null;
    await hit(caster, mule, spell);
    expect(down('strength')).toBe(0);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [], combatants: [] };
    await hit(caster, mule, spell);
    expect([down('strength'), down('speed'), down('smarts')]).toEqual([2, 2, 0]);
    global.game.combat.round = 4;
    expect(down('strength')).toBe(2);
    global.game.combat.round = 5;
    expect(down('strength')).toBe(0);
    global.game.combat = { id: 'c2', started: true, round: 2, turn: 0, turns: [], combatants: [] };
    expect(down('strength')).toBe(0);
  });
});

describe('Energon Efficiency: the dialog spend of the last Energon rolls a d6, 5+ gives the point back', () => {
  test('rollEnergonSpent Trigger', async () => {
    const { fireRollEnergonSpent } = await import('./plugins/rolls/energon-spend-bonus.mjs');
    const bot = makeActor([packItem('energonEfficiency')]);
    const random = jest.spyOn(Math, 'random');
    bot.system.energon.normal.value = 0;
    random.mockReturnValue(0.9);
    await fireRollEnergonSpent(bot, 1);
    expect(bot.system.energon.normal.value).toBe(1);
    bot.system.energon.normal.value = 0;
    random.mockReturnValue(0.1);
    await fireRollEnergonSpent(bot, 1);
    expect(bot.system.energon.normal.value).toBe(0);
    bot.system.energon.normal.value = 1;
    random.mockReturnValue(0.9);
    await fireRollEnergonSpent(bot, 2);
    expect(bot.system.energon.normal.value).toBe(1);
    random.mockRestore();
  });
});

describe('Ambitious: once per encounter, the test ignores its Snag and every ↓ (decided last)', () => {
  test('DialogSwitch clearPenalties, read by its ticked box after the limit is spent', async () => {
    const { ruleClearsPenalties } = await import('./plugins/dialog/switch-clear-penalties.mjs');
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const bot = makeActor([packItem('ambitious')]);
    const options = await tick(bot, { rolledSkill: 'athletics' }, 'Ambitious');
    expect(ruleClearsPenalties(bot, options)).toBe(true);
    expect(ruleClearsPenalties(bot, { ext: {} })).toBe(false);
    expect(switchNamed(bot, { rolledSkill: 'athletics' }, 'Ambitious')).toBeUndefined();
  });
});

describe('Unlucky (For You): a hit banks a Snag on the target, once per target per combat', () => {
  test('hit Trigger mark + bank snag', async () => {
    const ranger = makeActor([packItem('unlucky')], { name: 'Dark' });
    const foe = target('Foe');
    const blade = effect(ranger);
    global.game.combat = null;
    await hit(ranger, foe, blade);
    expect(bankedEntries(foe).length).toBe(0);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    await hit(ranger, foe, blade);
    expect(bankedEntries(foe)).toEqual([expect.objectContaining({ snag: true })]);
    await hit(ranger, foe, blade);
    expect(bankedEntries(foe).length).toBe(1);
  });
});

describe('Misled: the creature its holder assisted fails - ↓1 banked on its next Skill Test', () => {
  test('rollSeen with @var.assistedBy', async () => {
    const { rollSeen } = await import('./plugins/tags/world-watch.mjs');
    const mentor = makeActor([packItem('misled')], { name: 'Mentor' });
    const pupil = makeActor([], { name: 'Pupil' });
    const failed = [{ success: false, total: 5 }];
    await rollSeen(pupil, [{ success: true, total: 15 }], { lendAssistanceAssisterUuid: mentor.uuid });
    expect(bankedEntries(pupil).length).toBe(0);
    await rollSeen(pupil, failed, { lendAssistanceAssisterUuid: 'Actor.someoneElse' });
    expect(bankedEntries(pupil).length).toBe(0);
    await rollSeen(pupil, failed, { lendAssistanceAssisterUuid: mentor.uuid });
    expect(bankedEntries(pupil)).toEqual([expect.objectContaining({ shiftDown: 1 })]);
  });
});

describe('Move Like a Song: the first roll against the holder each round has a Snag, or misses if it already has one', () => {
  test('SnagOrMiss, one use per round spent when the roll goes ahead', async () => {
    const { ruleSnagOrMiss, spendSnagOrMiss } = await import('./plugins/combat/snag-or-miss.mjs');
    const green = makeActor([packItem('moveLikeASong')], { name: 'Green' });
    const foe = makeActor([], { name: 'Foe' });
    global.game.combat = null;
    expect(ruleSnagOrMiss(foe, green, {})).toBe(null);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [], combatants: [] };
    const first = ruleSnagOrMiss(foe, green, { item: effect(foe) });
    expect(first?.label).toMatch(/^Move Like a Song/);
    await spendSnagOrMiss(first.spend);
    expect(ruleSnagOrMiss(foe, green, {})).toBe(null);
    global.game.combat.round = 2;
    expect(ruleSnagOrMiss(foe, green, {})).not.toBe(null);
  });
});

describe('Consistent: give up a Critical Success for ↑1 on the next Skill Test', () => {
  test('CritDowngrade asks, then banks ↑1', async () => {
    const { askCritDowngrade, runCritDowngrade } = await import('./plugins/rolls/crit-downgrade.mjs');
    const medalist = makeActor([packItem('consistent')]);
    global.foundry.applications.api.DialogV2.confirm = jest.fn(async () => false);
    expect(await askCritDowngrade(medalist)).toBe(null);
    global.foundry.applications.api.DialogV2.confirm = jest.fn(async () => true);
    const picked = await askCritDowngrade(medalist);
    expect(picked).toBeTruthy();
    expect(await askCritDowngrade(makeActor([]))).toBe(null);
    await runCritDowngrade(medalist, picked);
    expect(bankedEntries(medalist)).toEqual([expect.objectContaining({ shiftUp: 1 })]);
  });
});

describe('Violent: ↑1 on a damaging ↓ alternate of a weapon whose primary effects deal no damage', () => {
  test('item:healthDamage + weapon:primariesNoDamage', () => {
    const brawler = makeActor([packItem('violent')]);
    const weapon = (primary) => {
      const w = makeItem({ name: 'Nunchaku', type: 'weapon', system: { equipped: true, items: {
        a: { type: 'weaponEffect', shiftDown: 0, damageType: primary, damageValue: 1 },
        b: { type: 'weaponEffect', shiftDown: 1, damageType: 'blunt', damageValue: 2 },
      } } });
      w.parent = brawler;
      brawler.items.contents.push(w);
      return w;
    };

    const stunner = weapon('stun');
    const club = weapon('blunt');
    const up = rolled => ruleRollSources(brawler, null, roll(rolled)).sources.reduce((sum, source) => sum + (source.shiftUp || 0), 0);
    const alt = (w, system) => effect(brawler, { parentId: w.id, system: { shiftDown: 1, damageType: 'blunt', damageValue: 2, ...system } });
    expect([up(alt(stunner)), up(alt(club)), up(alt(stunner, { shiftDown: 0 })), up(alt(stunner, { damageType: 'stun' }))]).toEqual([1, 0, 0, 0]);
  });
});

describe('Driving Strike: before a melee attack, 1 Personal Power to ignore armor or reroll the Skill dice', () => {
  test('DialogSelect with paid ignoreArmor / rerollSkillDice keys', async () => {
    const { extDialogToggles, runApplyDialog } = await import('../mechanics/item-hooks.mjs');
    const fighter = makeActor([packItem('drivingStrike')]);
    const blade = effect(fighter);
    const ctx = roll(blade);
    const select = extDialogToggles(fighter, ctx).find(toggle => toggle.label.startsWith('Driving Strike'));
    expect(select).toMatchObject({ type: 'select' });
    expect(extDialogToggles(fighter, roll(effect(fighter, { style: 'ranged' }))).some(toggle => toggle.label.startsWith('Driving Strike'))).toBe(false);
    const options = { ext: { [select.name]: '1' } };
    await runApplyDialog(fighter, options, ctx);
    expect([options.ruleKeys, fighter.system.powers.personal.value]).toEqual([['ignoreArmor'], 2]);
    const reroll = { ext: { [select.name]: '2' } };
    await runApplyDialog(fighter, reroll, ctx);
    expect([reroll.ruleKeys, fighter.system.powers.personal.value]).toEqual([['rerollSkillDice'], 1]);
    fighter.system.powers.personal.value = 0;
    expect(extDialogToggles(fighter, ctx).some(toggle => toggle.label.startsWith('Driving Strike'))).toBe(false);
  });
});
