import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, part "uses" (docs/rules-batches/slUses14.md): grant / rider / companion Use buttons and kits moved from
 * grants.mjs, target-riders.mjs, companions.mjs and kits.mjs onto rules. Each item is loaded from its pack source and
 * must do what the removed code (and its old tests) did.
 */

let picks = [];
let offered = [];
let rolls = [];
const rollsMade = [];
const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability ?? kitTier(entry.name))) && (!matches || matches(entry)))),
  pickOne: jest.fn(async (title, rows) => {
    offered.push(rows.map(row => row.name));
    const name = picks.shift();
    return rows.find(row => row.name == name)?.uuid ?? null;
  }),
  chooseSelect: jest.fn(async (title, prompt, options) => {
    offered.push(options.map(option => option.label));
    const answer = picks.shift();
    return options.find(option => option.label == answer || option.value == answer)?.value ?? null;
  }),
  grantCopy: jest.fn(async (actor, uuid, { grantedBy, flags, integrated, system } = {}) => {
    const entry = CATALOG.find(e => e.uuid == uuid);
    const [made] = await actor.createEmbeddedDocuments('Item', [{
      name: entry.name, type: entry.type, system: { ...JSON.parse(JSON.stringify(entry.system)), ...(integrated ? { integrated: true } : {}), ...(system ?? {}) },
      flags: { core: { sourceId: uuid }, essence20: { ...(flags ?? {}), grantedBy: grantedBy?.id } },
    }]);
    return made;
  }),
  rollTest: jest.fn(async (actor, skill, dif) => {
    rollsMade.push({ skill, dif });
    return rolls.shift() ?? { success: true, crit: false };
  }),
  markIntegrated: jest.fn(data => {
    data.system.integrated = true;
    return data;
  }),
  kitAvailability: name => kitTier(name),
  chooseButtons: jest.fn(async () => null),
};
const kitTier = name => (['limited', 'restricted'].includes(String(name).split(' ')[0].toLowerCase()) ? String(name).split(' ')[0].toLowerCase() : 'standard');
const conditions = [];
const saveCards = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/resources/requisition.mjs', () => ({ requisitionSkill: () => 'targeting' }));
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition: jest.fn(async (actor, status, rounds) => conditions.push({ name: actor.name, status, rounds })) }));
jest.unstable_mockModule('./mechanics/combat/save-riders.mjs', () => ({ postSaveCard: jest.fn(async (actor, targets, spec) => saveCards.push({ targets: targets.map(t => t.name), spec })), resolveSaveRoll: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(async () => {}), setEntryAndAddItem: jest.fn(async () => 'k1') }));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  customGear: 'gijcrbitems/_source/Custom_Gear_15b9YumuRnzL16XW.json',
  kitbasher: 'gijcrbitems/_source/Kitbasher_az09yEPydnE1tBTj.json',
  integratedOffense: 'gijcrbitems/_source/Integrated_Offense_H1ITRVeP9229PlfU.json',
  kitbashEquipment: 'gijcrbitems/_source/Kitbash_Equipment_4F6GJqqpHSZYFNqA.json',
  standardW: 'ccitems/_source/Standard_Weaponization_zNN9bu7QMXzpUgHB.json',
  limitedW: 'ccitems/_source/Limited_Weaponization_nzX5e7PPoHU3nLM3.json',
  martialW: 'ccitems/_source/Martial_Weaponization_IOum6G4uZdTDh4J9.json',
  armed: 'ccitems/_source/Armed_tH6Osix0iQGxowNz.json',
  quickDraw: 'ccitems/_source/Quick_Draw_YGr6vNEv9MKoVlyS.json',
  branchLeader: 'ccitems/_source/Branch_Leader_EwIMxCkVn5mj9ArG.json',
  thickSkulls: 'iafav2items/_source/Thick_Skulls_03a1UE6KBI1LIHOq.json',
  construct: 'tfcrbitems/_source/Construct_RoA7zBnU4Ke517k6.json',
  manifest: 'tfcrbitems/_source/Manifest_Melee_Weapon_MSCVNucCT6yMtptv.json',
  minorTweak: 'dditems/_source/Minor_Tweak_p07kuAT0RhfjudPo.json',
  monstrous: 'dditems/_source/Monstrous_Attack_nDEA1W86XvYR2ab4.json',
  neverUnarmed: 'dditems/_source/Never_Unarmed_zNRAyM9Y8y13eLhU.json',
  riotGear: 'wtnvcgitems/_source/Riot_Gear_SivYuju5Qcwu3npg.json',
  poisonChemistry: 'ccitems/_source/Poison_Chemistry_MOOrbfVEyGTDExfv.json',
  hacker: 'ccitems/_source/Hacker_s56rG7h3is1WNpz2.json',
  secondaryQuarry: 'dditems/_source/Secondary_Quarry_GS8YX7V6rYJLnkfQ.json',
  allOutAttack: 'gijcrbitems/_source/All_Out_Attack_Rhz1k6gTl2XTs8Nk.json',
  evasiveFighting: 'gijcrbitems/_source/Evasive_Fighting_tBXpROuVSuAxGZpR.json',
  artilleryLobber: 'gijcrbitems/_source/Artillery_Lobber_Effect_6SNB0WmDWMUkpr2X.json',
  jammer: 'gijcrbitems/_source/Jammer_gFTHcdhnTZojAqPM.json',
  whiteNoise: 'gijcrbitems/_source/White_Noise_Generator_F80nn3atqFJWhRWQ.json',
  geneticDecoding: 'ccitems/_source/Genetic_Decoding_3I9h6aspI3Cg0Fd0.json',
  energicShields: 'prcrbitems/_source/Energic_Shields_Lxmp3gfs8TmtUOI5.json',
  impactPoints: 'jttitems/_source/Enhanced_Impact_Points_FLV4BgCGfPPDxoAY.json',
  gremlins: 'jttitems/_source/Gremlins__Mischief_tOaR4ftVJadvAgbC.json',
  energyResistor: 'tfcrbitems/_source/Energy_Resistor_lKnjgN4TdHHNktpF.json',
  vineBombs: 'tsitems/_source/Vine_Bombs_Effect_WGWGdiX8drI5SFi6.json',
  ablativeHeavy: 'eocitems/_source/Ablative_Matrix__Heavy__fuztUMiuiIXsk2sI.json',
  ablativeLight: 'eocitems/_source/Ablative_Matrix__Light__wAVLN1sPaIxqxgN2.json',
  ablativeMedium: 'eocitems/_source/Ablative_Matrix__Medium__llGkZPM7l7hhyPs2.json',
  headache: 'wtnvcgitems/_source/Headache_Y9vCqznF8qHKHyO9.json',
  intervene: 'fgtaaitems/_source/Intervene_b1Ev6biHOHxXXQo4.json',
  shotsFired: 'fgtaaitems/_source/Shots_Fired_lcUcWMZxVUdLkycD.json',
  toughTogether: 'gijcrbitems/_source/Tough_Together_aGD2qvPmkdeL6ObV.json',
  favoriteGij: 'gijcrbitems/_source/Favorite_Command_ymF7fHkBglQ7pQRE.json',
  favoriteMlp: 'mlpcrbitems/_source/Favorite_Command_rPnaWCU06W8c0Zua.json',
  backupMaster: 'gijcrbitems/_source/Backup_Master_VV2qGG2gqmjKYcPl.json',
  extraFriend: 'mlpcrbitems/_source/Extra_Friend_Hg3B2BkTNnqTzRmr.json',
  ai: 'gijcrbitems/_source/Artificial_Intelligence_OBjcj6ordJi60Cdd.json',
  loyalMinions: 'dditems/_source/Loyal_Minions_MIghwIOKR1AqeQiY.json',
  crashSurvivor: 'ccitems/_source/Crash_Survivor_5SKezm0w5KQbdSJ4.json',
  hearty: 'ccitems/_source/Hearty_3Jh0J7IxLr6eF1uA.json',
  falseFace: 'qgtgitems/_source/False_Face_OGIfZabiFlcjwCaz.json',
  munitions: 'eocitems/_source/Personnel_Munitions_Pack_CXenUI5l8c3WZNSw.json',
};

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const attack = (style, extra = {}) => ({ type: 'weaponEffect', classification: { style }, ...extra });
const entry = (name, type, availability, system = {}, uuid = null) => ({
  uuid: uuid ?? `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type,
  system: { ...(availability ? { availability } : {}), traits: [], items: {}, ...system },
});
const CATALOG = [
  entry('Light Vest', 'armor', 'standard', { classification: 'light' }),
  entry('Heavy Plate', 'armor', 'standard', { classification: 'heavy' }),
  entry('Padding', 'upgrade', 'limited', { type: 'armor' }),
  entry('Scope', 'upgrade', 'limited', { type: 'weapon' }),
  entry('Plain Scope', 'upgrade', 'standard', { type: 'weapon' }),
  entry('Club', 'weapon', 'standard', { items: { a: attack('melee', { numHands: '1' }) } }),
  entry('Whip', 'weapon', 'standard', { items: { a: attack('thrown', { range: { reachMultiplier: 2 } }) } }),
  entry('Rifle', 'weapon', 'standard', { classification: { size: 'medium' }, items: { a: attack('projectile', { numHands: '2' }) } }),
  entry('Pistol', 'weapon', 'standard', { classification: { size: 'sidearm' }, items: { a: attack('projectile', { numHands: '1' }) } }),
  entry('Holdout', 'weapon', 'limited', { classification: { size: 'sidearm' }, items: { a: attack('projectile') } }),
  entry('Bomb', 'weapon', 'limited', { classification: { size: 'sidearm' }, items: { a: attack('explosive', { numHands: 0 }) } }),
  entry('Cannon', 'weapon', 'limited', { classification: { size: 'heavy' }, items: { a: attack('projectile', { numHands: '4' }) } }),
  entry('Sword', 'weapon', 'limited', { items: { a: attack('melee') } }),
  entry('Axe', 'weapon', 'restricted', { items: { a: attack('melee') } }),
  entry('Limited Burglary Kit', 'gear', null, { gearType: 'kits' }),
  entry('Rope', 'gear', null, { gearType: 'tools' }),
  entry('Microtech Weapon', 'upgrade', 'limited', { type: 'weapon' }, C('gi_joe_crb', 'ihSql0Px1kNgTBfP')),
  entry('Microtech Battledress', 'upgrade', 'limited', { type: 'armor' }, C('gi_joe_crb', 'ERqpa98s445vypnL')),
  entry('Weapon Training', 'perk', null, {}, C('gi_joe_crb', 'rFnoQTbnYQX2tlMe')),
  entry('Blow Gun', 'weapon', 'standard', { quantity: 1 }, C('wtnv_citizens_guide', 'pSsHrG2Bpd3mQnBD')),
  entry('Shotgun', 'weapon', 'standard', {}, C('wtnv_citizens_guide', '8AEIEs18V1gbcRDs')),
];

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
    name: doc.name, type: doc.type, img: doc.img, system: JSON.parse(JSON.stringify(doc.system)), _source: { system: JSON.parse(JSON.stringify(doc.system)) },
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } }, ...(extra.data ?? {}),
  });
}

const sourced = (uuid, data = {}) => makeItem({ name: data.name ?? 'Item', type: data.type ?? 'perk', flags: { core: { sourceId: uuid }, essence20: {} }, system: data.system ?? {}, ...data });

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(),
    system: {
      level: 10, skills: {}, health: { max: 10, value: 10 }, essences: { smarts: { max: 3 } }, immunities: {},
      defenses: { toughness: { total: 12, string: '12' }, willpower: { total: 12, string: '12' } }, ...(extra.system ?? {}),
    },
    effects: [],
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => (extra.token ? [extra.token] : []),
    toggleStatusEffect: jest.fn(async () => {}),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => getPath(actor.flags[scope], key);
  actor.setFlag = jest.fn(async (scope, key, value) => setPath(actor, `flags.${scope}.${key}`, value));
  actor.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(actor, key, value);
    }

    rebuildIndex(actor);
  });
  actor.createEmbeddedDocuments = jest.fn(async (type, datas) => {
    if (type == 'ActiveEffect') {
      const made = datas.map(data => ({ id: `e${nextId++}`, ...JSON.parse(JSON.stringify(data)) }));
      actor.effects.push(...made);
      return made;
    }

    const made = datas.map(data => {
      const one = makeItem(JSON.parse(JSON.stringify(data)));
      one.parent = actor;
      list.push(one);
      return one;
    });
    rebuildIndex(actor);
    return made;
  });
  actor.deleteEmbeddedDocuments = jest.fn(async (type, ids) => {
    const from = type == 'ActiveEffect' ? actor.effects : list;
    for (const id of ids) {
      const at = from.findIndex(i => i.id == id);
      if (at >= 0) {
        from.splice(at, 1);
      }
    }

    rebuildIndex(actor);
  });
  actor.updateEmbeddedDocuments = jest.fn(async () => {});
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  ALL.push(actor);
  rebuildIndex(actor);
  return actor;
}

function give(actor, item) {
  item.parent = actor;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { runUse, useAvailable, fireTriggers } = await import('./triggers.mjs');
const { ruleDerived, ruleRollSources, ruleDamageType, ruleCriticalOptions } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { stanceToggles, stanceApply } = await import('./plugins/combat/stance-switch.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { markedTargetSources } = await import('./plugins/marks/rule-marks.mjs');
const { meetsKitPrerequisite, kitInfo } = await import('../mechanics/resources/kits.mjs');
const { checkPrimaryQuarry } = await import('../items/rolls/primary-quarry.mjs');
const { ablativeLossOf } = await import('../mechanics/combat/target-riders.mjs');
const { canCommand, commandIsMove } = await import('../mechanics/companions/companions.mjs');
const { grantKindOf, isGrantUse } = await import('../mechanics/resources/grant-uses.mjs');
const { isRiderUse } = await import('../mechanics/combat/rider-uses.mjs');
const { isCompanionUse } = await import('../mechanics/companions/companion-uses.mjs');
const { kitUseKind } = await import('../mechanics/resources/kits.mjs');

const pay = jest.fn(async () => true);
let chooses = [];
const ask = async (step, options) => {
  const want = chooses.shift();
  const at = options.findIndex(option => option.label == want);
  return at < 0 ? null : at;
};

const use =item => runUse(item, pay, { ask });
const available = item => item.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use')
  .some(({ rule, index }) => useAvailable(item, rule, index));
const granted = (actor, item) => actor.items.contents.filter(other => other.flags?.essence20?.grantedBy == item.id);
let dialogAnswers = [];
let prompts = [];

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = getPath;
  global.foundry.utils.deepClone = value => JSON.parse(JSON.stringify(value));
});

beforeEach(() => {
  picks = [];
  offered = [];
  rolls = [];
  chooses = [];
  dialogAnswers = [];
  prompts = [];
  rollsMade.length = 0;
  conditions.length = 0;
  saveCards.length = 0;
  ALL.length = 0;
  pay.mockClear();
  global.foundry.applications.api.DialogV2 = {
    wait: jest.fn(async () => dialogAnswers.shift() ?? null),
    prompt: jest.fn(async () => prompts.shift() ?? null),
    confirm: jest.fn(async () => false),
  };
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1, set: async () => {} };
  global.game.actors = [];
  global.game.actors.party = null;
  global.game.actors.get = id => ALL.find(a => a.id == id && a.documentName == 'Actor');
  global.game.i18n = { localize: k => k, format: k => k, has: () => false };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid);
    return found ? { ...found, toObject: () => JSON.parse(JSON.stringify({ name: found.name, type: found.type, system: found.system })) } : null;
  });
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15 };
  global.CONFIG.E20.skills = { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight', technology: 'E20.SkillTechnology', science: 'E20.SkillScience' };
  global.CONFIG.E20.skillToEssence = { athletics: 'strength', might: 'strength', technology: 'smarts', science: 'smarts', driving: 'speed', deception: 'social', infiltration: 'speed' };
  global.CONFIG.E20.skillShiftList = ['3d6', '2d8', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd20'];
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

test('the old Use tables no longer claim the converted items', () => {
  const src = key => `Compendium.essence20.x.Item.${fromPack(FILES[key])._id}`;
  for (const [pack, key] of [['gi_joe_crb', 'customGear'], ['cobra_codex', 'armed'], ['tf_crb', 'construct'], ['wtnv_citizens_guide', 'riotGear']]) {
    const item = sourced(C(pack, fromPack(FILES[key])._id));
    expect([key, isGrantUse(item), grantKindOf(item)]).toEqual([key, false, null]);
  }

  expect(isRiderUse(sourced(C('cobra_codex', 'MOOrbfVEyGTDExfv')))).toBe(false);
  expect(isRiderUse(sourced(C('gi_joe_crb', 'gFTHcdhnTZojAqPM')))).toBe(false);
  expect(isCompanionUse(sourced(C('decepticon_directive', 'MIghwIOKR1AqeQiY')))).toBe(false);
  expect(isCompanionUse(sourced(C('gi_joe_crb', 'VV2qGG2gqmjKYcPl')))).toBe(false);
  expect(kitUseKind(sourced(C('cobra_codex', '5SKezm0w5KQbdSJ4')))).toBeNull();
  expect(kitUseKind(sourced(C('quartermasters_guide_to_gear', 'OGIfZabiFlcjwCaz')))).toBeNull();
  expect(src('munitions')).toContain('CXenUI5l8c3WZNSw');
});

/* -------------------------------------------- */
/*  Grants                                       */
/* -------------------------------------------- */

describe('free picks and once-only grants', () => {
  test('Custom Gear: light/medium armor, a Limited armor upgrade and a Limited weapon upgrade; a skipped pick carries on', async () => {
    const perk = packItem('customGear');
    const actor = makeActor([perk]);
    picks = [null, 'Padding', 'Scope'];
    await use(perk);
    expect(offered[0]).toEqual(['Light Vest']);
    expect(offered[1]).toEqual(['Padding', 'Microtech Battledress']);
    expect(offered[2]).toEqual(['Scope', 'Microtech Weapon']);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Padding', 'Scope']);
    expect(perk.flags.essence20.granted).toBe(true);
    expect(available(perk)).toBe(false);

    // Nothing picked: not done, the button stays.
    const other = packItem('customGear');
    makeActor([other]);
    await use(other);
    expect(other.flags.essence20.granted).toBeUndefined();
    expect(available(other)).toBe(true);
  });

  test('Standard / Limited Weaponization: a Reach weapon of that Availability, Integrated, once', async () => {
    const perk = packItem('standardW');
    const actor = makeActor([perk]);
    picks = ['Whip'];
    await use(perk);
    expect(offered[0]).toEqual(['Club', 'Whip']);
    expect(granted(actor, perk)[0]).toMatchObject({ name: 'Whip', system: expect.objectContaining({ integrated: true }) });
    expect(available(perk)).toBe(false);

    const limited = packItem('limitedW');
    makeActor([limited]);
    picks = ['Sword'];
    await use(limited);
    expect(offered[1]).toEqual(['Sword']);
  });

  test('Martial Weaponization: a one-handed ranged Medium or Sidearm weapon, Standard or Limited', async () => {
    const perk = packItem('martialW');
    makeActor([perk]);
    picks = ['Pistol'];
    await use(perk);
    // Rifle takes two hands, Bomb's attack 0 hands, Cannon is heavy; Holdout's attack has no hand count (one).
    expect(offered[0]).toEqual(['Pistol', 'Holdout']);
  });

  test('Integrated Offense: Microtech upgrades up to half the level', async () => {
    const perk = packItem('integratedOffense');
    const actor = makeActor([perk], { system: { level: 4 } });
    chooses = ['Microtech Weapon'];
    await use(perk);
    chooses = ['Microtech Battledress'];
    await use(perk);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Microtech Weapon', 'Microtech Battledress']);
    expect(perk.flags.essence20.grantedCount).toBe(2);
    expect(available(perk)).toBe(false);
    actor.system.level = 6;
    expect(available(perk)).toBe(true);
  });

  test('Armed: Weapon Training (once) and up to three Adept Armaments; Quick Draw one more and the free draw', async () => {
    const perk = packItem('armed');
    const weapons = ['A', 'B', 'C', 'D'].map(name => makeItem({ name, type: 'weapon', system: {} }));
    const actor = makeActor([perk, ...weapons]);
    dialogAnswers = [weapons.map(w => w.id)];
    await use(perk);
    expect(actor.items.contents.filter(i => i.name == 'Weapon Training')).toHaveLength(1);
    expect(weapons.map(w => !!w.flags.essence20.adeptArmament)).toEqual([true, true, true, false]);
    expect(perk.flags.essence20.granted).toBe(true);

    const draw = give(actor, packItem('quickDraw'));
    dialogAnswers = [[weapons[3].id]];
    await use(draw);
    expect(weapons[3].flags.essence20.adeptArmament).toBe(true);
    expect(available(draw)).toBe(false);
    const cost = costRulesFor(actor).find(rule => rule.matches({ key: 'drawWeapon' }));
    expect(cost).toMatchObject({ ask: 'E20.ActionPerkAskAdeptDraw' });
    expect(cost.to()).toBe('free');
  });

  test('Branch Leader: a G.I. JOE Role other than your own becomes your Branch, once', async () => {
    const perk = packItem('branchLeader');
    const role = sourced(C('gi_joe_crb', 'SvByuJ6hUITwR5Q7'), { name: 'Infantry', type: 'role' });
    const actor = makeActor([perk, role]);
    let labels = [];
    await runUse(perk, pay, { ask: async (step, options) => {
      labels = options.map(option => option.label);
      return labels.indexOf('Officer');
    } });
    expect(labels).toEqual(['Commando', 'Officer', 'Old Hand', 'Ranger', 'Renegade', 'Technician', 'Vanguard']);
    expect(actor.flags.essence20.exemplarBranch).toBe(C('gi_joe_crb', 'VBEsSU8jqBpoGueE'));
    expect(available(perk)).toBe(false);
  });

  test('Monstrous Attack: an extra Unarmed attack, double reach, 2 Blunt or Sharp, once', async () => {
    const perk = packItem('monstrous');
    const actor = makeActor([perk]);
    chooses = ['Sharp'];
    await use(perk);
    const [made] = granted(actor, perk);
    expect(made.type).toBe('weaponEffect');
    expect(made.system).toEqual(expect.objectContaining({ damageType: 'sharp', damageValue: 2, range: { reachMultiplier: 2 }, classification: { skill: 'might', style: 'melee' } }));
    expect(available(perk)).toBe(false);
  });
});

describe('made on the spot', () => {
  test('Kitbash Equipment: picks first, then the Standard action; DIF from Availability (a kit from its name); 10 rounds, 20 on a crit', async () => {
    const perk = packItem('kitbashEquipment');
    const actor = makeActor([perk]);
    chooses = ['Weapon'];
    picks = ['Rifle'];
    await use(perk);
    expect(offered[0]).not.toContain('Cannon');
    expect(pay).toHaveBeenCalledWith('standard');
    expect(granted(actor, perk)[0].flags.essence20.rulesExpiry.until).toBe('rounds:10');

    chooses = ['Gear'];
    picks = ['Limited Burglary Kit'];
    rolls = [{ success: true, crit: true }];
    await use(perk);
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 10 });
    expect(granted(actor, perk).at(-1)).toMatchObject({ name: 'Limited Burglary Kit', flags: { essence20: { rulesExpiry: { until: 'rounds:20' } } } });

    // A cancelled pick costs nothing; a failed test makes nothing.
    pay.mockClear();
    chooses = ['Weapon'];
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    chooses = ['Weapon'];
    picks = ['Club'];
    rolls = [{ success: false }];
    await use(perk);
    expect(granted(actor, perk)).toHaveLength(2);
  });

  test('Construct: an Energon Point on a success (none with Perpetual Power Source), nothing on a failure', async () => {
    const perk = packItem('construct');
    const actor = makeActor([perk], { system: { energon: { normal: { value: 0 } } } });
    chooses = ['Weapon'];
    picks = ['Sword'];
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    expect(granted(actor, perk)).toHaveLength(0);

    actor.system.energon.normal.value = 2;
    chooses = ['Kit'];
    picks = ['Limited Burglary Kit'];
    rolls = [{ success: false }];
    await use(perk);
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 10 });
    expect(actor.system.energon.normal.value).toBe(2);
    expect(offered.at(-1)).toEqual(['Limited Burglary Kit']);

    chooses = ['Armor Upgrade'];
    picks = ['Padding'];
    await use(perk);
    expect(pay).toHaveBeenLastCalledWith('standard');
    expect(actor.system.energon.normal.value).toBe(1);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Padding']);

    give(actor, sourced(C('tf_crb', 'zFB2pS1PIJc6gzUE'), { name: 'Perpetual Power Source' }));
    chooses = ['Weapon'];
    picks = ['Club'];
    await use(perk);
    expect(actor.system.energon.normal.value).toBe(1);
  });

  test('Manifest Melee Weapon: in combat, once per encounter; Standard, +Limited with Expanded Arsenal, +Restricted with Instruments', async () => {
    const perk = packItem('manifest');
    const actor = makeActor([perk]);
    expect(available(perk)).toBe(false);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
    expect(available(perk)).toBe(true);
    picks = ['Club'];
    await use(perk);
    expect(offered[0]).toEqual(['Club', 'Whip']);
    expect(pay).toHaveBeenCalledWith('free');
    expect(granted(actor, perk)[0]).toMatchObject({ name: 'Club (Energon)', system: expect.objectContaining({ integrated: true }), flags: { essence20: { rulesExpiry: { until: 'combat' } } } });
    expect(available(perk)).toBe(false);

    actor.flags.essence20.manifestMeleeWeapon = null;
    give(actor, sourced(C('tf_crb', 'doPXx4JM7nS998Ue'), { name: 'Expanded Arsenal' }));
    picks = [null];
    await use(perk);
    expect(offered[1]).toEqual(['Club', 'Whip', 'Sword']);
    give(actor, sourced(C('tf_crb', 'ybrluGy9norsyiMm'), { name: 'Instruments of Destruction' }));
    picks = [null];
    await use(perk);
    expect(offered[2]).toEqual(['Club', 'Whip', 'Sword', 'Axe']);
  });

  test('Never Unarmed: a Move action for a Silent one-handed makeshift weapon until the scene ends or it Fumbles', async () => {
    const perk = packItem('neverUnarmed');
    const actor = makeActor([perk]);
    chooses = ['Finesse', 'Blunt'];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('move');
    const [weapon] = granted(actor, perk);
    expect(weapon.system.traits).toEqual(['silent']);
    expect(weapon.flags.essence20).toMatchObject({ endsOnFumble: true, rulesExpiry: { until: 'scene' } });
    const effect = actor.items.contents.find(i => i.flags.essence20.parentId == weapon.id);
    expect(effect.system).toEqual(expect.objectContaining({ classification: { skill: 'finesse', style: 'melee' }, damageType: 'blunt', damageValue: 1 }));
  });

  test('Riot Gear: in combat, once per mission (the old riotGear count); the Blow Gun comes with 5 darts', async () => {
    const perk = packItem('riotGear');
    const actor = makeActor([perk]);
    expect(available(perk)).toBe(false);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0 };
    chooses = ['Blow Gun (5 darts)'];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(granted(actor, perk)[0]).toMatchObject({ name: 'Blow Gun', system: expect.objectContaining({ quantity: 5 }), flags: { essence20: { rulesExpiry: { until: 'combat' } } } });
    expect(available(perk)).toBe(false);
  });

  test('Minor Tweak: DIF 14 for one Strength / Speed rank, more tiers with Major Augments; replaces the last tweak on the target', async () => {
    const perk = packItem('minorTweak');
    const actor = makeActor([perk]);
    actor.effects.push({ id: 'old', flags: { essence20: { minorTweak: true } } });
    picks = ['athletics'];
    await use(perk);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 14 }]);
    expect(offered[0]).toEqual(expect.arrayContaining(['E20.SkillAthletics', 'E20.SkillFinesse']));
    expect(offered[0]).not.toContain('E20.SkillScience');
    expect(actor.effects).toEqual([expect.objectContaining({ name: 'Minor Tweak', flags: { essence20: { minorTweak: true } }, changes: [{ key: 'system.skills.athletics.shiftUp', mode: 2, value: '1' }] })]);

    give(actor, sourced(C('decepticon_directive', '0XjyYHChhc0VStRn'), { name: 'Major Augments' }));
    const ally = makeActor([], { name: 'Ally' });
    global.game.user.targets = new Set([{ actor: ally }]);
    chooses = ['DIF 18: 2 temporary Skill Ranks'];
    picks = ['science', 'science'];
    await use(perk);
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 18 });
    expect(ally.effects[0].changes).toEqual([{ key: 'system.skills.science.shiftUp', mode: 2, value: '1' }, { key: 'system.skills.science.shiftUp', mode: 2, value: '1' }]);
    rolls = [{ success: false }];
    chooses = ['DIF 18: 2 temporary Skill Ranks'];
    await use(perk);
    expect(ally.effects).toHaveLength(1);
  });

  test('Thick Skulls: how many Smarts increases went to Toughness moves that much from Willpower', async () => {
    const perk = packItem('thickSkulls');
    const actor = makeActor([perk]);
    prompts = [2];
    await use(perk);
    expect(perk.flags.essence20.toToughness).toBe(2);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness).toEqual({ total: 14, string: '12 + 2 (Thick Skulls)' });
    expect(actor.system.defenses.willpower).toEqual({ total: 10, string: '12 - 2 (Thick Skulls)' });
  });
});

/* -------------------------------------------- */
/*  Riders                                       */
/* -------------------------------------------- */

describe('poisons, picks and quarry', () => {
  test('Poison Chemistry: pick a poison and its new state before the Standard action', async () => {
    const perk = packItem('poisonChemistry');
    const poison = makeItem({ name: 'Venom', type: 'weapon', system: { isPoison: true, poisonApplication: { contact: true, ingested: false, inhaled: false } } });
    makeActor([perk, poison, makeItem({ name: 'Knife', type: 'weapon', system: {} })]);
    picks = ['Venom', 'inhaled'];
    await use(perk);
    expect(offered[0]).toEqual(['Venom']);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(poison.system.poisonApplication).toEqual({ contact: false, ingested: false, inhaled: true });
  });

  test('Hacker: a poison is marked a hacker poison, and back again', async () => {
    const perk = packItem('hacker');
    const poison = makeItem({ name: 'Venom', type: 'weapon', system: { isPoison: true } });
    makeActor([perk, poison]);
    picks = ['Venom'];
    await use(perk);
    expect(poison.flags.essence20.hackerPoison).toBe(true);
    picks = ['Venom'];
    await use(perk);
    expect(poison.flags.essence20.hackerPoison).toBe(false);
  });

  test('Secondary Mark: the target becomes a second Primary Quarry', async () => {
    const perk = packItem('secondaryQuarry');
    const actor = makeActor([perk]);
    const quarry = makeActor([], { name: 'Quarry' });
    await use(perk);
    expect(actor.flags.essence20.secondaryQuarryUuid).toBeUndefined();
    global.game.user.targets = new Set([{ actor: quarry }]);
    await use(perk);
    expect(actor.flags.essence20.secondaryQuarryUuid).toBe(quarry.uuid);
    perk.flags.core.sourceId = 'Compendium.essence20.decepticon_directive.Item.GS8YX7V6rYJLnkfQ';
    expect(checkPrimaryQuarry(actor, quarry)).toBe(true);
  });

  test('Genetic Decoding: every Essence offered on a crit until one is picked, then only that one', async () => {
    const perk = packItem('geneticDecoding');
    const actor = makeActor([perk]);
    const crit = () => ruleCriticalOptions(actor, null, { type: 'weaponEffect', system: {} }).options;
    expect(crit().map(o => o.essence)).toEqual(['strength', 'speed', 'smarts', 'social']);
    expect(crit()[0]).toMatchObject({ label: 'Genetic Decoding (Strength)', damageValue: 1, damageType: 'special' });
    picks = ['smarts'];
    await use(perk);
    expect(crit().map(o => o.essence)).toEqual(['smarts']);
  });
});

describe('stances and devices', () => {
  test.each(['allOutAttack', 'evasiveFighting'])('%s (GI JOE): a 0-5 box on Might / Finesse / Targeting attacks on your turn; that many ↓ and the stance', async key => {
    const actor = makeActor([packItem(key)]);
    const roll = skill => ({ item: { type: 'weaponEffect', system: { classification: { skill } } } });
    expect(stanceToggles(actor, roll('might'))).toEqual([expect.objectContaining({ type: 'number', max: 5 })]);
    expect(stanceToggles(actor, roll('athletics'))).toEqual([]);
    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, combatant: { actor: { id: 'other' } }, turns: [] };
    expect(stanceToggles(actor, roll('might'))).toEqual([]);
    global.game.combat = null;
    const [toggle] = stanceToggles(actor, roll('finesse'));
    const options = { shiftDown: 0, ext: { [toggle.name]: 3 } };
    await stanceApply(actor, options);
    expect(options.shiftDown).toBe(3);
    expect(actor.flags.essence20.riderStance[key]).toBe(3);
  });

  test.each([['jammer', 'technology'], ['whiteNoise', 'alertness']])('%s: switched on and off; while on, a Snag on %s for the holder', async (key, skill) => {
    const device = packItem(key);
    const token = { id: 't1', center: { x: 0, y: 0 }, document: { disposition: 1 } };
    const actor = makeActor([device], { token });
    global.canvas = { scene: {}, tokens: { placeables: [{ ...token, actor }] }, grid: { measurePath: () => ({ distance: 0 }) } };
    expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources).toEqual([]);
    await use(device);
    expect(device.flags.essence20.rules.toggles.on).toBe(true);
    expect(ruleRollSources(actor, null, { rolledSkill: skill }).sources[0]).toMatchObject({ label: device.name, snag: true });
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
    await use(device);
    expect(device.flags.essence20.rules.toggles.on).toBe(false);
  });
});

describe('Defenses, damage types and immunities', () => {
  test('Energic Shields: +3 Toughness while Morphed against the picked damage type', async () => {
    const perk = packItem('energicShields');
    const defender = makeActor([perk], { system: { isMorphed: true } });
    const attacker = makeActor();
    const fire = { item: { type: 'weaponEffect', system: { damageType: 'fire' } }, isAttack: true };
    expect(lateDefenseAdjust(attacker, defender, 'toughness', fire)).toBe(0);
    picks = ['fire'];
    await use(perk);
    expect(lateDefenseAdjust(attacker, defender, 'toughness', fire)).toBe(3);
    expect(lateDefenseAdjust(attacker, defender, 'evasion', fire)).toBe(0);
    expect(lateDefenseAdjust(attacker, defender, 'toughness', { item: { type: 'weaponEffect', system: { damageType: 'cold' } }, isAttack: true })).toBe(0);
    defender.system.isMorphed = false;
    expect(lateDefenseAdjust(attacker, defender, 'toughness', fire)).toBe(0);
  });

  test('Enhanced Impact Points: a Blunt / Sharp unarmed alternate gets its ↓ back while Morphed', () => {
    const actor = makeActor([packItem('impactPoints')], { system: { isMorphed: true } });
    const alternate = { type: 'weaponEffect', flags: {}, system: { damageType: 'sharp', shiftDown: 2 } };
    expect(ruleRollSources(actor, null, { item: alternate, isAttack: true }).sources[0]).toMatchObject({ shiftUp: 2 });
    expect(ruleRollSources(actor, null, { item: { ...alternate, flags: { essence20: { parentId: 'w' } } }, isAttack: true }).sources).toEqual([]);
    actor.system.isMorphed = false;
    expect(ruleRollSources(actor, null, { item: alternate, isAttack: true }).sources).toEqual([]);
  });

  test("Gremlins' Mischief: 1 Personal Power at a mechanical target, unarmed strikes deal EMP this turn", async () => {
    const perk = packItem('gremlins');
    const actor = makeActor([perk], { system: { powers: { personal: { value: 1, max: 3 } } } });
    const fist = { type: 'weaponEffect', flags: {}, system: { damageType: 'blunt' } };
    await use(perk);
    expect(actor.system.powers.personal.value).toBe(1);
    global.game.user.targets = new Set([{ actor: makeActor([], { system: { creatureTags: 'robot' } }) }]);
    await use(perk);
    expect(actor.system.powers.personal.value).toBe(0);
    expect(ruleDamageType(actor, null, { item: fist, isAttack: true })).toBe('emp');
    expect(ruleDamageType(actor, null, { item: { ...fist, flags: { essence20: { parentId: 'w' } } }, isAttack: true })).toBeNull();
    expect(available(perk)).toBe(false);
  });

  test('Energy Resistor: immune to the picked energy type while its armor is worn (or loose)', async () => {
    const armor = makeItem({ name: 'Armor', type: 'armor', system: { equipped: true } });
    const upgrade = packItem('energyResistor', { flags: { parentId: armor.id } });
    const actor = makeActor([armor, upgrade]);
    ruleDerived(actor);
    expect(actor.system.immunities).toEqual({});
    picks = ['laser'];
    await use(upgrade);
    ruleDerived(actor);
    expect(actor.system.immunities.laser).toBe(true);
    actor.system.immunities = {};
    armor.system.equipped = false;
    ruleDerived(actor);
    expect(actor.system.immunities.laser).toBeUndefined();
  });

  test.each(['ablativeHeavy', 'ablativeLight', 'ablativeMedium'])('%s: a Critical Success attack that hits the wearer wears it down, to 0 at most', async key => {
    const upgrade = packItem(key);
    upgrade._source = { system: { armorBonus: { value: 2 } } };
    const wearer = makeActor([upgrade]);
    const attacker = makeActor();
    const roll = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    await fireTriggers(wearer, 'targeted', { roll, outcome: 'success', targets: [attacker] });
    expect(ablativeLossOf(upgrade)).toBe(0);
    for (let i = 0; i < 3; i++) {
      await fireTriggers(wearer, 'targeted', { roll, outcome: 'crit', targets: [attacker] });
    }

    expect(ablativeLossOf(upgrade)).toBe(2);
  });
});

describe('on a hit', () => {
  test('Artillery Lobber Effect: its hit knocks the target Prone; Vine Bombs grapple and post the escape card', async () => {
    const lobber = packItem('artilleryLobber');
    const actor = makeActor([lobber]);
    const target = makeActor([], { name: 'Target' });
    await fireTriggers(actor, 'hit', { roll: { item: lobber, isAttack: true }, outcome: 'success', targets: [target] });
    expect(conditions).toEqual([{ name: 'Target', status: 'prone', rounds: 0 }]);
    await fireTriggers(actor, 'hit', { roll: { item: { type: 'weaponEffect', id: 'other', system: {} }, isAttack: true }, outcome: 'success', targets: [target] });
    expect(conditions).toHaveLength(1);

    const vines = give(actor, packItem('vineBombs'));
    await fireTriggers(actor, 'hit', { roll: { item: vines, isAttack: true }, outcome: 'success', targets: [target] });
    expect(conditions.at(-1)).toEqual({ name: 'Target', status: 'grappled', rounds: 0 });
    expect(saveCards).toEqual([{ targets: ['Target'], spec: { title: 'Escape the Vine Bombs (vs 16 Toughness)', skills: ['might', 'athletics'], dif: 16, status: 'grappled', removeOnSuccess: true } }]);
  });

  test('Headache: unarmed hits offer extra Psychic damage equal to the Essence damage, as its own button', () => {
    const attacker = makeActor([packItem('headache')], { system: { essences: { strength: { max: 4, value: 2 }, speed: { max: 2, value: 1 } } } });
    const target = makeActor();
    const fist = makeItem({ type: 'weaponEffect', system: { damageValue: 2 } });
    const result = { damageValue: 2, damageType: 'blunt' };
    hitRiderOnAttack(attacker, target, result, { itemUuid: fist.uuid }, { damageBonusNote: jest.fn() });
    expect(result.damageValue).toBe(2);
    expect(result.riderOptions).toEqual([expect.objectContaining({ key: 'headache', damageValue: 3, damageType: 'psychic' })]);
    attacker.system.essences = { strength: { max: 4, value: 4 } };
    const none = { damageValue: 2 };
    hitRiderOnAttack(attacker, target, none, { itemUuid: fist.uuid }, { damageBonusNote: jest.fn() });
    expect(none.riderOptions).toBeUndefined();
  });

  test('Shots Fired: damage dealt marks the creature; Social tests against it gain an Edge', async () => {
    const attacker = makeActor([packItem('shotsFired')]);
    const target = makeActor([], { name: 'Mark' });
    expect(ruleRollSources(attacker, target, { rolledSkill: 'intimidation' }).sources).toEqual([]);
    await fireTriggers(attacker, 'dealtDamage', { damage: { amount: 2 }, targets: [target] });
    expect(ruleRollSources(attacker, target, { rolledSkill: 'intimidation' }).sources[0]).toMatchObject({ edge: true });
    expect(ruleRollSources(attacker, target, { rolledSkill: 'might' }).sources).toEqual([]);
    expect(ruleRollSources(makeActor([packItem('shotsFired')]), target, { rolledSkill: 'deception' }).sources).toEqual([]);
  });

  test("Intervene: a marked ally's Resistance is a Snag on the next Blunt / Sharp attack against them, used up", async () => {
    const tokenOf = (id, disposition) => ({ id, center: { x: 0, y: 0 }, document: { disposition } });
    const holderToken = tokenOf('th', 1);
    const allyToken = tokenOf('ta', 1);
    const holder = makeActor([packItem('intervene')], { name: 'Bodyguard', token: holderToken });
    const ally = makeActor([], { name: 'Ally', token: allyToken });
    const foe = makeActor([], { name: 'Foe' });
    global.canvas = { scene: {}, tokens: { placeables: [{ ...holderToken, actor: holder }, { ...allyToken, actor: ally }] }, grid: { measurePath: () => ({ distance: 10 }) } };
    const stun = { item: { type: 'weaponEffect', system: { damageType: 'stun' } }, isAttack: true, targetCount: 1 };
    await fireTriggers(ally, 'afterRoll', { roll: { ...stun, item: { type: 'weaponEffect', system: { damageType: 'laser' } } }, outcome: 'failure' });
    expect(ally.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(ally, 'afterRoll', { roll: stun, outcome: 'failure' });
    expect(ally.flags.essence20.ruleMarks.intervene).toMatchObject({ by: holder.uuid, until: 'combat' });
    const blunt = { item: { type: 'weaponEffect', system: { damageType: 'blunt' } }, isAttack: true };
    const out = markedTargetSources(foe, ally, blunt);
    expect(out.sources[0]).toMatchObject({ label: 'Intervene', snag: true });
    expect(out.consumes).toEqual([{ ext: 'rulesMark', actorUuid: ally.uuid, key: 'intervene' }]);
    expect(markedTargetSources(foe, ally, { item: { type: 'weaponEffect', system: { damageType: 'laser' } }, isAttack: true }).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Companions                                   */
/* -------------------------------------------- */

describe('companions', () => {
  test('Tough Together: the pet gains 1 Health', () => {
    const owner = makeActor([packItem('toughTogether')], { name: 'Owner' });
    const pet = makeActor([], { name: 'Pet', type: 'companion', flags: { companionOf: owner.uuid }, system: { health: { max: 4, value: 4 } } });
    ruleDerived(pet);
    expect(pet.system.health.max).toBe(5);
  });

  test('Favorite Command: the Skill is picked on the Perk; commanding the pet becomes a Move action', async () => {
    for (const key of ['favoriteGij', 'favoriteMlp']) {
      const owner = makeActor([], { name: 'Owner' });
      const perk = packItem(key);
      perk.flags.core.sourceId = key == 'favoriteGij' ? C('gi_joe_crb', 'ymF7fHkBglQ7pQRE') : C('mlp_crb', 'rPnaWCU06W8c0Zua');
      const pet = makeActor([perk], { type: 'companion', system: { type: 'pet' }, flags: { companionOf: owner.uuid } });
      global.game.actors.push(owner, pet);
      expect(commandIsMove(owner)).toBe(false);
      picks = ['might'];
      await use(perk);
      expect(perk.flags.essence20.favoriteSkill).toBe('might');
      expect(commandIsMove(owner)).toBe(true);
      global.game.actors.length = 0;
    }
  });

  test('Backup Master / Extra Friend: a designated character may command the pet', async () => {
    for (const key of ['backupMaster', 'extraFriend']) {
      const owner = makeActor([], { name: 'Owner' });
      const friend = makeActor([], { name: 'Friend' });
      const perk = packItem(key);
      perk.flags.core.sourceId = key == 'backupMaster' ? C('gi_joe_crb', 'VV2qGG2gqmjKYcPl') : C('mlp_crb', 'Hg3B2BkTNnqTzRmr');
      const pet = makeActor([perk], { type: 'companion', system: { type: 'pet' }, flags: { companionOf: owner.uuid } });
      global.game.actors.push(owner, friend, pet);
      expect(canCommand(friend, pet)).toBe(false);
      picks = ['Friend'];
      await use(perk);
      expect(canCommand(friend, pet)).toBe(true);
      expect(canCommand(owner, pet)).toBe(true);
      global.game.actors.length = 0;
    }
  });

  test('Artificial Intelligence: an uncommanded drone repeats its last Command at its turn start', async () => {
    const drone = makeActor([packItem('ai')], { name: 'Drone', type: 'companion' });
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [] };
    await fireTriggers(drone, 'turnStart');
    expect(ChatMessage.create).not.toHaveBeenCalled();
    drone.flags.essence20.petCommand = { skill: 'alertness', combatId: 'c1', round: 2 };
    await fireTriggers(drone, 'turnStart');
    expect(ChatMessage.create).not.toHaveBeenCalled();
    drone.flags.essence20.petCommand.round = 1;
    await fireTriggers(drone, 'turnStart');
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test('Loyal Minions: a Free action and a DIF 10 test give the Mini-Cons ↑1 this round', async () => {
    const perk = packItem('loyalMinions');
    const owner = makeActor([perk], { name: 'Owner' });
    const miniCon = makeActor([], { name: 'Mini', type: 'companion', system: { type: 'miniCon' }, flags: { companionOf: owner.uuid } });
    const pet = makeActor([], { name: 'Pet', type: 'companion', system: { type: 'pet' }, flags: { companionOf: owner.uuid } });
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, turns: [] };
    rolls = [{ success: false }];
    chooses = ['Persuasion (Leadership)'];
    await use(perk);
    expect(rollsMade).toEqual([{ skill: 'persuasion', dif: 10 }]);
    expect(pay).toHaveBeenCalledWith('free');
    expect(ruleRollSources(miniCon, null, { rolledSkill: 'might' }).sources).toEqual([]);
    chooses = ['Intimidation (Command)'];
    await use(perk);
    expect(ruleRollSources(miniCon, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ label: 'Loyal Minions', shiftUp: 1 });
    expect(ruleRollSources(pet, null, { rolledSkill: 'might' }).sources).toEqual([]);
    global.game.combat.round = 2;
    expect(ruleRollSources(miniCon, null, { rolledSkill: 'might' }).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Kits                                         */
/* -------------------------------------------- */

describe('kits', () => {
  test('Kitbasher: any kit may be used without its prerequisite, a Skill Kit too', () => {
    const actor = makeActor([], { system: { skills: { infiltration: { shift: 'd20' }, deception: { shift: 'd8' } } } });
    expect(meetsKitPrerequisite(actor, { tier: 'restricted', skill: 'infiltration' })).toBe(false);
    expect(meetsKitPrerequisite(actor, { skillKit: true, skill: 'deception', maxRank: 'd20' })).toBe(false);
    give(actor, packItem('kitbasher'));
    expect(meetsKitPrerequisite(actor, { tier: 'restricted', skill: 'infiltration' })).toBe(true);
    expect(meetsKitPrerequisite(actor, { skillKit: true, skill: 'deception', maxRank: 'd20' })).toBe(true);
  });

  test.each([['crashSurvivor', 'Air'], ['hearty', 'Sea']])('%s: a fresh Limited Driving (%s) Kit, usable without prerequisites, replaces the last', async (key, spec) => {
    const perk = packItem(key);
    const actor = makeActor([perk], { system: { skills: { driving: { shift: 'd20' } } } });
    await use(perk);
    await use(perk);
    const kits = granted(actor, perk);
    expect(kits).toHaveLength(1);
    expect(kits[0]).toMatchObject({ name: `Limited Driving (${spec}) Kit`, flags: { essence20: { kit: { tier: 'limited', skill: 'driving', spec }, ignorePrerequisite: true } } });
    expect(meetsKitPrerequisite(actor, kitInfo(kits[0]))).toBe(true);
  });

  test('False Face: a Standard Disguise Kit per two levels, two traded for a Limited at 3rd, four for a Restricted at 6th', async () => {
    const perk = packItem('falseFace');
    const actor = makeActor([perk], { system: { level: 2 } });
    await use(perk);
    expect(granted(actor, perk).map(k => k.name)).toEqual(['Standard Deception (Disguise) Kit']);

    actor.system.level = 7;
    let offeredLabels = [];
    await runUse(perk, pay, { ask: async (step, options) => {
      offeredLabels.push(options.map(o => o.label));
      const want = ['Restricted Disguise Kit (four Standard)', 'Limited Disguise Kit (two Standard)', 'Limited Disguise Kit (two Standard)'][offeredLabels.length - 1];
      return options.findIndex(o => o.label == want);
    } });
    expect(granted(actor, perk).map(k => k.flags.essence20.kit.tier)).toEqual(['restricted']);
    expect(offeredLabels[0]).toHaveLength(3);
    offeredLabels = [];
    // 7th level: 4 kits' worth - a Restricted uses them all; cancelling keeps what was made.
    await runUse(perk, pay, { ask: async () => (offeredLabels.push(1) == 1 ? 0 : null) });
    expect(granted(actor, perk).map(k => k.flags.essence20.kit.tier)).toEqual(['standard']);
  });

  test('Personnel Munitions Pack: a Free action reloads a targeted weapon (or your own); a 1 on the d20 uses it up', async () => {
    const pack = packItem('munitions', { data: { system: { ...fromPack(FILES.munitions).system, quantity: 1 } } });
    const own = makeItem({ name: 'Rifle', type: 'weapon', flags: { essence20: { needsReload: 2 } }, system: {} });
    const actor = makeActor([pack, own]);
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    picks = ['Rifle'];
    await use(pack);
    expect(pay).toHaveBeenCalledWith('free');
    expect(own.flags.essence20.needsReload).toBe(1);

    const theirs = makeItem({ name: 'Pistol', type: 'weapon', flags: { essence20: { needsReload: true } }, system: {} });
    const ally = makeActor([theirs], { name: 'Ally' });
    global.game.user.targets = new Set([{ actor: ally }]);
    random.mockReturnValue(0);
    picks = ['Pistol'];
    await use(pack);
    expect(theirs.flags.essence20.needsReload).toBe(0);
    expect(actor.items.contents).not.toContain(pack);
    random.mockRestore();
  });
});
