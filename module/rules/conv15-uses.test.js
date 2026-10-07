import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, part "uses" (docs/rules-batches/slUses15.md): the survey's "piece" items of grants.mjs, target-riders.mjs,
 * companions.mjs and kits.mjs, converted onto rules once their engine pieces existed. Each item is loaded from its pack
 * source and must do what the removed code (and its old tests) did.
 */

let picks = [];
let offered = [];
let rolls = [];
const rollsMade = [];
const dealt = [];
const vsMany = [];
let vsRows = [];
let vsMultipliers = [];
const vsExtras = [];
let points = [];
const placed = [];
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
  rollTest: jest.fn(async (actor, skill, dif, extra = {}) => {
    rollsMade.push({ name: actor.name, skill, dif, ...(extra.edge ? { edge: true } : {}) });
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
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({ applyTimedCondition: jest.fn(async (actor, status, rounds) => conditions.push({ name: actor.name, status, rounds })) }));
const toughness = [];
jest.unstable_mockModule('./sheet-handlers/perk-handler.mjs', () => ({
  setMorphedToughnessBonus: jest.fn(async actor => toughness.push(actor.name)),
  grantPerkOutright: jest.fn(async (actor, uuid) => {
    const found = CATALOG.find(e => e.uuid == uuid);
    await actor.createEmbeddedDocuments('Item', [{ name: found?.name ?? 'Perk', type: 'perk', flags: { core: { sourceId: uuid }, essence20: {} }, system: {} }]);
  }),
}));
const factionDrops = [];
jest.unstable_mockModule('./sheet-handlers/faction-handler.mjs', () => ({ onFactionDrop: jest.fn(async (actor, drop, item) => factionDrops.push(item.name)) }));
const lendAssistanceSkill = jest.fn(async () => false);
jest.unstable_mockModule('./mechanics/actions/lend-assistance.mjs', () => ({ lendAssistanceSkill, activateLendAssistance: jest.fn(), LEND_ASSISTANCE_SHIFT_FLAG: 'pendingLendAssistanceShift' }));
const economy = { setSprinting: jest.fn(async () => {}), spend: jest.fn(async () => ({ blocked: false })), isAiming: () => false, getLedger: () => ({}) };
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => economy);
const riders = { rollShove: jest.fn(async () => ({ message: null })), disarm: jest.fn(async () => null) };
jest.unstable_mockModule('./mechanics/combat/target-riders.mjs', () => riders);
jest.unstable_mockModule('./mechanics/resources/requisition.mjs', () => ({ requisitionSkill: () => 'targeting' }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(async () => {}), setEntryAndAddItem: jest.fn(async () => 'k1') }));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type) => dealt.push({ name: actor.name, amount, type })),
  getVehicleDriver: jest.fn(),
}));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({
  lastApplyContext: () => null,
  gmDo: jest.fn(),
  rollVs: jest.fn(),
  rollVsMany: jest.fn(async (actor, skill, others, defense, _essence = null, extra = null) => {
    vsMany.push({ skill, defense, targets: others.map(other => other.name) });
    vsExtras.push(extra);
    return others.map((other, i) => ({ targetUuid: other.uuid, success: vsRows[i] ?? true, multiplier: vsMultipliers[i] ?? 1 }));
  }),
}));
jest.unstable_mockModule('./mechanics/combat/forced-movement.mjs', () => ({
  IMMOVABLE_OBJECT_ID: 'x',
  pickCanvasPoint: jest.fn(async () => points.shift() ?? null),
  placeActorAt: jest.fn(async (actor, point) => {
    placed.push({ name: actor.name, ...point });
    return true;
  }),
  distanceFeet: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  pushActor: jest.fn(),
  slowNextTurn: jest.fn(),
  movementPenaltyFor: () => 0,
  pushDestination: jest.fn(),
  resistsForcedMovement: async () => false,
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  candle: 'mlpcrbitems/_source/Candle_s0uI9etsaZdaP3xN.json',
  torch: 'mlpcrbitems/_source/Torch_oVB4sfY5HHIEGTA3.json',
  headlamp: 'kocitems/_source/Headlamp_m2hiT236MOKHKyvJ.json',
  lantern: 'kocitems/_source/Candlesprite_Lantern_MhKwWyukMEdzsfRC.json',
  checkmate: 'gijcrbitems/_source/Checkmate_BcFM3JhWdk5XHIZL.json',
  teleportingBeam: 'mlpcrbitems/_source/Teleporting_Beam_RhSRS4n3dG9TQ92L.json',
  ghillie: 'gijcrbitems/_source/Ghillie_Suit_Sniping_O3w2NL8H2gCtkWzN.json',
  wrist: 'prcrbitems/_source/Wrist_Communicator_W7nXP8pOQaDJmZbT.json',
  commandAndControl: 'dditems/_source/Command___Control_oPtLbnCPYyCSZIVU.json',
  packAttack: 'gijcrbitems/_source/Pack_Attack_7k9DzU918tm8OK9V.json',
  harmonics: 'qgtgitems/_source/Automatic_Harmonics_Foow2rilePmztBFk.json',
  ambush: 'tfcrbitems/_source/Ambush_Deployment_NMVCdrUBejXHGBOa.json',
  shieldCompanion: 'tfcrbitems/_source/Shield_Companion_K46iTCabKbKdBQKA.json',
  acidSacs: 'wtnvcgitems/_source/Acid_Sacs_8sUOMdsOyxfF0o1s.json',
  constrictor: 'ccitems/_source/Constrictor_S63cNsFogI1Ahh2C.json',
  telemetry: 'qgtgitems/_source/Telemetry_Data_U4Ug6iUQC4Ehzs5l.json',
  terminal: 'qgtgitems/_source/Terminal_Guidance_kqqN3i3ZR8qYHQaN.json',
  buzz: 'qgtgitems/_source/Buzz_The_Tower_q0LPjcOQ0bnTSZTy.json',
  sensors: 'tfcrbitems/_source/Enhanced_Sensors_Qqw4h2kmK8HsE3zC.json',
  forage: 'gijcrbitems/_source/Forage_QXpG3NuwaFgbdc0x.json',
  environmental: 'gijcrbitems/_source/Environmental_Weapon__Environmental__K6taaZgeGFxX4lA3.json',
  weaponForage: 'fffav1items/_source/Weapon_Forage_OWVl8HRXBI7mwJ0j.json',
  quickbash: 'gijcrbitems/_source/Quickbash_YlihpNSSspqwfMv6.json',
  manifestEnhancement: 'tfcrbitems/_source/Manifest_Enhancement_syJ8looy53vONS0X.json',
  brainstorm: 'jttitems/_source/Brainstorm_iVpoqL7ZY4SK4iLc.json',
  droneWeapon: 'gijcrbitems/_source/Integrated_Specialized_Weapon_ddLUrsn3t96NpUqL.json',
  inventive1: 'jttitems/_source/Inventive_Application_1_ubR7N8PYKDMSxmkM.json',
  inventive2: 'jttitems/_source/Inventive_Application_2_As1eUnG5W54GwotE.json',
  multifaceted: 'fffav1items/_source/Multifaceted_05INUNEBfKDL6GmJ.json',
  multifacetedHangUp: 'fffav1items/_source/Multifaceted_g6bxWMq3UDSstUfp.json',
  volatile: 'dditems/_source/Volatile_Delivery_HJd2dd41bj3oY899.json',
  cordial: 'fffav1items/_source/Cordial_I4tkodAyDsVPSXCU.json',
  rough: 'sssitems/_source/Rough_and_Takes_No_Guff_2SHHZs1qVMFBB2kW.json',
  medKit: 'prcrbitems/_source/Med_Kit_UgggFXZqiyKxwMuA.json',
  repairKit: 'tfadvitems/_source/Automated_Repair_Kit_2P2i605rHgNhm2FJ.json',
  corn: 'wtnvcgitems/_source/Imaginary_Corn_2i8jWYZH14Cu30LO.json',
  allyAwareness: 'tfcrbitems/_source/Ally_Awareness_WzccenAOAQxiARf7.json',
  assistantGij: 'gijcrbitems/_source/Assistant_l6nLJeg8ev4mhNwE.json',
  assistantMlp: 'mlpcrbitems/_source/Assistant_ueOByvZQdpmGc3Ds.json',
  bomber: 'ccitems/_source/Bomber_WW5PNoq6d3CBU3FC.json',
  medicineCabinet: 'ccitems/_source/Medicine_Cabinet_d5xmwJqcoXyhVIVK.json',
  handyScrounger: 'qgtgitems/_source/Handy_Scrounger_uXV4DoOaLhrZmIkz.json',
  stretching: 'qgtgitems/_source/Stretching_Resources_CJTtjWkUl7BhiaN4.json',
  kittedOut: 'ccitems/_source/Kitted_Out_f0GAXS72eKNLB6x1.json',
  loader: 'tfcrbitems/_source/Loader_OVTDUJRI81VCrFZg.json',
  protomatter: 'eocitems/_source/Protomatter_Injection_Layer_LjibCLhbxNxaQnrU.json',
  onMyMark: 'dditems/_source/On_My_Mark__rkAvOCaF0RxnawZe.json',
  coDependent: 'eocitems/_source/Co_Dependent_2tPC2AgganNw2GgO.json',
  revealWeakness: 'fgtaaitems/_source/Reveal_Weakness_r2VrdENpcDTo0WGO.json',
  highlyEffective: 'ccitems/_source/Highly_Effective_KEDIY0wDCLbOIXuR.json',
  flurry: 'ccitems/_source/Flurry_of_Attacks_Fv2fYJxjgGyqAbq6.json',
  fanatic: 'dditems/_source/Fanatic_QhiG6aB3Z2GM1Get.json',
  agreeable: 'gijcrbitems/_source/Agreeable_2b51OQSju1kswWLj.json',
  baseTech: 'ccitems/_source/Base_Technological_Advancement_3ZW6OOOli170AwsW.json',
  salvaged: 'fffav1items/_source/Salvaged_sA8GbXKPcRuPHzNt.json',
  augur: 'eocitems/_source/Augur_yk2MnBePZ5gxOEOj.json',
  steadyHand: 'ccitems/_source/Steady_Hand_1zreGdgegCeRjJPT.json',
  animalize: 'ccitems/_source/Animalize_362Yyjs1INvYufPN.json',
  onTheJob: 'iafav2items/_source/On_The_Job_Training_uSPdZBM1S7VZ0lyy.json',
  cybMilitary: 'fgtaaitems/_source/Cybertronian_Military_j1EQkzPX3k5HgVMQ.json',
  cybAttitude: 'fgtaaitems/_source/Cybertronian_with_Attitude_me3jAybxn8Smb83w.json',
  cybPerk: 'fgtaaitems/_source/Cybertronian_Perk_VoYFiyFRGgMQ7ob0.json',
  reservist: 'fffav1items/_source/Faction_Reservist_w6fjujYpg8DrnuMX.json',
  fieldPromotion: 'fffav1items/_source/Field_Promotion_aeXmsn13l790Jxqr.json',
  factionsEnvoy: 'fgtaaitems/_source/Factions_Y9FmJITVz3nXJQCc.json',
  muzzlePunch: 'qgtgitems/_source/Muzzle_Punch_uwr8mZd2KXIZt61D.json',
  wreckingBall: 'gijcrbitems/_source/Wrecking_Ball_t8OnOh6dQ0FoWBsG.json',
  bowlOver: 'prcrbitems/_source/Bowl_Over_3oeSWdRfUpOq6b9y.json',
  pinpoint: 'tfcrbitems/_source/Pinpoint_r810HCughuqpIhaZ.json',
  makeAnOpening: 'dditems/_source/Make_An_Opening_DezsS1cuMwU8Qiwb.json',
  snatch: 'fffav1items/_source/Snatch_a5DNgno8XV7pVBzO.json',
  disarmingShotDD: 'dditems/_source/Disarming_Shot_K2uvTIYYzCixgBD7.json',
  scapegoat: 'ccitems/_source/Scapegoat_T2NO8rvrvvVYOuAP.json',
  gyroGun: 'eocitems/_source/Gyro_Gun_Alternate_Effect_pkAJxZG4ujXfdBem.json',
  shapedCharges: 'gijcrbitems/_source/Shaped_Charges_xFMzM5pycDmmw4u3.json',
  concentratedExplosion: 'ccitems/_source/Concentrated_Explosion_1Dsom5S1ByB6Egbk.json',
  concentratedFire: 'ccitems/_source/Concentrated_Fire_2UPKeLtWRXIoDlux.json',
  unstoppableForce: 'gijcrbitems/_source/Unstoppable_Force_DwnPEw2POcj3f0Za.json',
  dismantleFirearm: 'iafav2items/_source/Dismantle_Firearm_6XYgRBQGPm7gF41b.json',
  poisonProdigy: 'ccitems/_source/Poison_Prodigy_qkvDR7I1tBwOyStY.json',
  primaryTech: 'gijcrbitems/_source/Primary_Tech_5eOqntPaqp1g4M7k.json',
  secondaryTech: 'gijcrbitems/_source/Secondary_Tech_p301AoQlteHsA4pH.json',
  iCanDoThat: 'jttitems/_source/I_Can_Do_That_e26WbtPYfNCm12LO.json',
  iCanStillDoThat: 'jttitems/_source/I_Can_Still_Do_That_JgHOsyaD5WR5lgMk.json',
};

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const attack = (style, extra = {}) => ({ type: 'weaponEffect', classification: { style }, ...extra });
const entry = (name, type, availability, system = {}, uuid = null) => ({
  uuid: uuid ?? `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type,
  system: { ...(availability ? { availability } : {}), traits: [], items: {}, ...system },
});
const CATALOG = [
  entry('Sniper Rifle', 'weapon', 'restricted', { traits: ['sniper'], items: { a: attack('projectile') } }),
  entry('Plain Rifle', 'weapon', 'standard', { items: { a: attack('projectile') } }),
  entry('Prototype Sniper', 'weapon', 'prototype', { traits: ['sniper'] }),
  entry('Scope', 'upgrade', 'limited', { type: 'weapon' }),
  entry('Padding', 'upgrade', 'limited', { type: 'armor' }),
  entry('Night Vision Goggles', 'gear', null, {}, C('gi_joe_crb', 'XvqqYOHHpjRzb8T4')),
  entry('Laser Designator', 'gear', null, {}, C('gi_joe_crb', 'AcNaNxZnyOfXv0f6')),
  entry('Acute Sense', 'perk', null, {}, C('tf_crb', 'rl8hs6ezb6VSDahM')),
  entry('Standard Medicine Kit', 'gear', null, { gearType: 'kits' }),
  entry('Limited Burglary Kit', 'gear', null, { gearType: 'kits' }),
  entry('Restricted Climbing Kit', 'gear', null, { gearType: 'kits' }),
  entry('Rope', 'gear', null, { gearType: 'tools' }),
  entry('Club', 'weapon', 'standard', { items: { a: attack('melee', { damageValue: 1 }) } }),
  entry('Whip', 'weapon', 'limited', { items: { a: attack('thrown', { range: { reachMultiplier: 2 } }) } }),
  entry('Cannon', 'weapon', 'limited', { items: { a: attack('projectile', { numHands: '4' }) } }),
  entry('Hand Laser', 'weapon', 'standard', { classification: { size: 'sidearm' }, items: { a: attack('projectile', { damageValue: 2 }) } }),
  entry('Big Pistol', 'weapon', 'standard', { classification: { size: 'sidearm' }, items: { a: attack('projectile', { damageValue: 3 }) } }),
  entry('Power Staff', 'weapon', 'standard', { traits: ['powerWeapon'], items: { a: attack('melee', { damageValue: 2 }) } }),
  entry('Prototype Gun', 'weapon', 'prototype', {}),
  entry('Unique Gadget', 'gear', 'unique', {}),
  entry('Salvaged', 'upgrade', 'standard', { type: 'weapon' }, C('ferocious_fighters', 'sA8GbXKPcRuPHzNt')),
  entry('Restricted Barrel', 'upgrade', 'restricted', { type: 'weapon' }),
  entry('Element Grenade', 'weapon', 'standard', { quantity: 3, elementChoice: '' }, C('gi_joe_crb', 'pcBbvGPdjOoeUnnj')),
  entry('Perk A', 'perk', null, {}, C('fac', 'PerkAAAAAAAAAAAA')),
  entry('Perk B', 'perk', null, {}, C('fac', 'PerkBBBBBBBBBBBB')),
  entry('Perk C', 'perk', null, {}, C('fac', 'PerkCCCCCCCCCCCC')),
  entry('Own Faction', 'faction', null, { items: { a: { uuid: C('fac', 'PerkAAAAAAAAAAAA'), name: 'Perk A', type: 'perk' } } }, C('fac', 'OwnFactionAAAAAA')),
  entry('Other Faction', 'faction', null, { items: { b: { uuid: C('fac', 'PerkBBBBBBBBBBBB'), name: 'Perk B', type: 'perk' }, c: { uuid: C('fac', 'PerkCCCCCCCCCCCC'), name: 'Perk C', type: 'perk' } } }, C('fac', 'OtherFactionAAAA')),
];

let nextId = 1;
const ALL = [];

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
  item.setFlag = jest.fn(async (scope, key, value) => {
    setPath(item, `flags.${scope}.${key}`, value);
    if (item.parent) {
      rebuildIndex(item.parent);
    }
  });
  item.getFlag = (scope, key) => getPath(item.flags?.[scope], key);
  item.updateEmbeddedDocuments = jest.fn(async (type, updates) => {
    for (const { _id, ...rest } of updates) {
      const effect = item.effects.find(e => e.id == _id);
      Object.assign(effect ?? {}, rest);
    }
  });
  ALL.push(item);
  return item;
}

function packItem(key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, img: doc.img, system: JSON.parse(JSON.stringify(doc.system)), _source: { system: JSON.parse(JSON.stringify(doc.system)) },
    flags: { core: { sourceId: extra.source ?? `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } }, ...(extra.data ?? {}),
  });
}

/** A token at a point; `light` for the token-light tests. */
function tokenAt(x, y, extra = {}) {
  const token = { id: `t${nextId++}`, center: { x, y }, w: 100, h: 100, document: { x: x - 50, y: y - 50, width: 1, disposition: extra.disposition ?? 1, light: { bright: 0, dim: 0, angle: 360 } } };
  token.document.update = jest.fn(async update => {
    for (const [key, value] of Object.entries(update)) {
      setPath(token.document, key, value);
    }
  });
  return token;
}

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(extra.statuses ?? []),
    system: {
      level: 10, skills: {}, health: { max: 10, value: 10 }, essences: { smarts: { max: 3 } }, immunities: {},
      defenses: { toughness: { total: 12, string: '12' }, evasion: { total: 11, string: '11' }, willpower: { total: 13, string: '13' }, cleverness: { total: 14, string: '14' } },
      ...(extra.system ?? {}),
    },
    effects: [],
    items: { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), find: fn => list.find(fn), some: fn => list.some(fn), [Symbol.iterator]: () => list[Symbol.iterator]() },
    getActiveTokens: () => (actor.token ? [actor.token] : []),
    toggleStatusEffect: jest.fn(async () => {}),
  };
  actor.token = extra.token ?? null;
  if (actor.token) {
    actor.token.actor = actor;
  }

  actor.uuid = `Actor.${actor.id}`;
  actor.getFlag = (scope, key) => getPath(actor.flags[scope], key);
  actor.setFlag = jest.fn(async (scope, key, value) => {
    setPath(actor, `flags.${scope}.${key}`, value);
    rebuildIndex(actor);
  });
  actor.unsetFlag = jest.fn(async (scope, key) => setPath(actor, `flags.${scope}.-=${key}`, null));
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
  actor.updateEmbeddedDocuments = jest.fn(async (type, updates) => {
    for (const { _id, ...rest } of updates) {
      const item = list.find(i => i.id == _id);
      for (const [key, value] of Object.entries(rest)) {
        if (item) {
          setPath(item, key, value);
        }
      }
    }

    rebuildIndex(actor);
  });
  for (const item of items) {
    item.parent = actor;
    list.push(item);
  }

  ALL.push(actor);
  global.game.actors.push(actor);
  rebuildIndex(actor);
  return actor;
}

function give(actor, item) {
  item.parent = actor;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

/** A companion of `owner` (companions.mjs keeps the owner's uuid in flags.essence20.companionOf). */
const companion = (owner, type, extra = {}) => makeActor(extra.items ?? [], { ...extra, type: 'companion', system: { type, ...(extra.system ?? {}) }, flags: { companionOf: owner.uuid, ...(extra.flags ?? {}) } });

const { rebuildIndex } = await import('./index.mjs');
await import('./plugins/index.mjs');
const { runUse, useAvailable, fireTriggers } = await import('./triggers.mjs');
const { ruleRollSources, ruleAssist, ruleDerived } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { extDefenseAdjust } = await import('../mechanics/item-hooks.mjs');
const { noteRolledAgainst } = await import('../mechanics/companions/companions.mjs');
const { isGrantUse } = await import('../mechanics/resources/grant-uses.mjs');
const { isRiderUse } = await import('../mechanics/combat/rider-uses.mjs');
const { isCompanionUse } = await import('../mechanics/companions/companion-uses.mjs');
const { kitUseKind, restKits, KIT } = await import('../mechanics/resources/kits.mjs');

const pay = jest.fn(async () => true);
let chooses = [];
const ask = async (step, options) => {
  const want = chooses.shift();
  const at = options.findIndex(option => option.label == want);
  return at < 0 ? null : at;
};

const use = item => runUse(item, pay, { ask });
const available = item => item.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use')
  .some(({ rule, index }) => useAvailable(item, rule, index));
const granted = (actor, item) => actor.items.contents.filter(other => other.flags?.essence20?.grantedBy == item.id);
const target = (...actors) => {
  const set = new Set(actors.map(actor => ({ actor, id: actor.token?.id })));
  set.first = () => [...set][0];
  global.game.user.targets = set;
};

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
  points = [];
  vsRows = [];
  vsMultipliers = [];
  vsExtras.length = 0;
  rollsMade.length = 0;
  conditions.length = 0;
  dealt.length = 0;
  vsMany.length = 0;
  placed.length = 0;
  ALL.length = 0;
  pay.mockClear();
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1, set: async () => {} };
  global.game.actors = [];
  global.game.actors.party = null;
  global.game.actors.get = id => ALL.find(a => a.id == id && a.documentName == 'Actor');
  global.game.i18n = { localize: k => k, format: (k, data) => `${k}${data ? JSON.stringify(data) : ''}`, has: () => false };
  global.canvas = { scene: { id: 's1' }, tokens: { placeables: [], setTargets: jest.fn() }, grid: { measurePath: ([a, b]) => ({ distance: Math.hypot(a.x - b.x, a.y - b.y) / 20 }) } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid);
    return found ? { ...found, toObject: () => JSON.parse(JSON.stringify({ name: found.name, type: found.type, system: found.system })) } : ALL.find(doc => doc.uuid == uuid) ?? null;
  });
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15 };
  global.CONFIG.E20.skills = { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight', technology: 'E20.SkillTechnology', persuasion: 'E20.SkillPersuasion' };
  global.CONFIG.E20.skillToEssence = { athletics: 'strength', might: 'strength', technology: 'smarts', persuasion: 'social', acrobatics: 'speed', deception: 'social', driving: 'speed' };
});

/** Put actors' tokens on the canvas (placeables) so side / range lookups find them. */
const onCanvas = (...actors) => {
  global.canvas.tokens.placeables = actors.map(actor => actor.token).filter(Boolean);
};

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
  for (const [pack, id] of [['mlp_crb', 's0uI9etsaZdaP3xN'], ['mlp_crb', 'oVB4sfY5HHIEGTA3'], ['knights_of_canterlot', 'm2hiT236MOKHKyvJ'], ['knights_of_canterlot', 'MhKwWyukMEdzsfRC'], ['gi_joe_crb', 'O3w2NL8H2gCtkWzN']]) {
    expect([id, isGrantUse({ flags: { core: { sourceId: C(pack, id) } } })]).toEqual([id, false]);
  }

  expect(isRiderUse({ flags: { core: { sourceId: C('gi_joe_crb', 'BcFM3JhWdk5XHIZL') } } })).toBe(false);
  for (const id of ['U4Ug6iUQC4Ehzs5l', 'kqqN3i3ZR8qYHQaN', 'q0LPjcOQ0bnTSZTy']) {
    expect(isCompanionUse({ flags: { core: { sourceId: C('quartermasters_guide_to_gear', id) } } })).toBe(false);
  }

  expect(isCompanionUse({ flags: { core: { sourceId: C('tf_crb', 'Qqw4h2kmK8HsE3zC') } } })).toBe(false);
  expect(kitUseKind({ flags: { core: { sourceId: KIT.wristCommunicator } } })).toBeNull();
});

/* -------------------------------------------- */
/*  Lights                                       */
/* -------------------------------------------- */

describe('lights (tokenLight)', () => {
  test.each([['candle', 10, 25, 360], ['torch', 25, 50, 360], ['headlamp', 10, 20, 60], ['lantern', 10, 20, 360]])('%s lights the carrier\'s token and goes out again', async (key, bright, dim, angle) => {
    const light = packItem(key);
    const token = tokenAt(0, 0);
    token.document.light = { bright: 3, dim: 4, angle: 90 };
    makeActor([light], { token });
    await use(light);
    expect(token.document.update).toHaveBeenLastCalledWith({ 'light.bright': bright, 'light.dim': dim, 'light.angle': angle });
    expect(light.flags.essence20).toMatchObject({ lit: true, previousLight: { bright: 3, dim: 4, angle: 90 } });
    await use(light);
    expect(token.document.update).toHaveBeenLastCalledWith({ 'light.bright': 3, 'light.dim': 4, 'light.angle': 90 });
    expect(light.flags.essence20.lit).toBe(false);
  });

  test('a light already lit by the old code goes out on the next press; no token only flips it', async () => {
    const torch = packItem('torch', { flags: { lit: true, previousLight: { bright: 0, dim: 0, angle: 360 } } });
    const token = tokenAt(0, 0);
    makeActor([torch], { token });
    await use(torch);
    expect(token.document.update).toHaveBeenCalledWith({ 'light.bright': 0, 'light.dim': 0, 'light.angle': 360 });
    const candle = packItem('candle');
    makeActor([candle]);
    await use(candle);
    expect(candle.flags.essence20.lit).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Moving creatures (moveTo)                    */
/* -------------------------------------------- */

describe('moving to a picked point (moveTo)', () => {
  test('Checkmate: a target and a point, then the Standard action and Persuasion vs Willpower; a success moves each hit target', async () => {
    const perk = packItem('checkmate');
    const actor = makeActor([perk], { token: tokenAt(0, 0) });
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    const foe = makeActor([], { name: 'Foe', token: tokenAt(100, 0) });
    const other = makeActor([], { name: 'Other', token: tokenAt(200, 0) });
    target(foe, other);
    points = [null];
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    points = [{ x: 500, y: 500 }];
    vsRows = [true, false];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(vsMany).toEqual([{ skill: 'persuasion', defense: 'willpower', targets: ['Foe', 'Other'] }]);
    expect(placed).toEqual([{ name: 'Foe', x: 500, y: 500 }]);
    expect(actor).toBeTruthy();
  });

  test('Teleporting Beam: each creature the spell hits is put on a picked point within 60 ft of the caster', async () => {
    const spell = packItem('teleportingBeam');
    const caster = makeActor([spell], { token: tokenAt(0, 0) });
    const foe = makeActor([], { name: 'Foe', token: tokenAt(10, 0) });
    points = [{ x: 30, y: 40 }];
    await fireTriggers(caster, 'hit', { roll: { item: spell }, outcome: 'success', targets: [foe] });
    expect(placed).toEqual([{ name: 'Foe', x: 30, y: 40 }]);
    points = [{ x: 600, y: 800 }];
    await fireTriggers(caster, 'hit', { roll: { item: spell }, outcome: 'success', targets: [foe] });
    expect(placed).toHaveLength(1);
    expect(ui.notifications.warn).toHaveBeenCalled();
    await fireTriggers(caster, 'hit', { roll: { item: { id: 'other', type: 'spell', system: {} } }, outcome: 'success', targets: [foe] });
    expect(placed).toHaveLength(1);
  });

  test('Ghillie Suit Sniping: the sniper weapon and upgrade once, then in the first round a hidden prone position', async () => {
    const perk = packItem('ghillie');
    const token = tokenAt(0, 0);
    const actor = makeActor([perk], { token });
    picks = ['Sniper Rifle', 'Scope'];
    await use(perk);
    expect(offered[0]).toEqual(['Sniper Rifle']);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Sniper Rifle', 'Scope']);
    expect(perk.flags.essence20.granted).toBe(true);
    expect(available(perk)).toBe(false);
    global.game.combat = { id: 'c', round: 1, turn: 0, started: true };
    expect(available(perk)).toBe(true);
    points = [{ x: 400, y: 300 }];
    await use(perk);
    expect(token.document.update).toHaveBeenCalledWith({ x: 350, y: 250 });
    expect(conditions).toEqual([{ name: 'Hero', status: 'prone', rounds: 0 }, { name: 'Hero', status: 'invisible', rounds: 0 }]);
    global.game.combat.round = 2;
    expect(available(perk)).toBe(false);

    // No weapon picked: nothing is granted and the button stays.
    const other = packItem('ghillie');
    makeActor([other]);
    await use(other);
    expect(other.flags.essence20.granted).toBeUndefined();
  });

  test('Wrist Communicator: three teleports, then none until a rest', async () => {
    const comm = packItem('wrist');
    const token = tokenAt(0, 0);
    const actor = makeActor([comm], { token });
    for (let i = 0; i < 3; i++) {
      points = [{ x: 100, y: 100 }];
      await use(comm);
    }

    expect(token.document.update).toHaveBeenCalledWith({ x: 50, y: 50 }, { animate: false });
    expect(comm.flags.essence20.chargesUsed).toBe(3);
    expect(available(comm)).toBe(false);
    await restKits(actor);
    expect(available(comm)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Companions                                   */
/* -------------------------------------------- */

describe('companions', () => {
  test('Command & Control: a Mini-Con and its owner help each other whatever their ranks, within 100 ft', () => {
    const owner = makeActor([packItem('commandAndControl')], { name: 'Owner', token: tokenAt(0, 0), system: { skills: { might: { shift: 'd10' } } } });
    const miniCon = companion(owner, 'miniCon', { name: 'Mini', token: tokenAt(80 * 20, 0), system: { skills: { might: { shift: 'd20' } } } });
    const pet = companion(owner, 'pet', { name: 'Pet', token: tokenAt(0, 20), system: { skills: { might: { shift: 'd20' } } } });
    const stranger = makeActor([], { name: 'Stranger', token: tokenAt(0, 40), system: { skills: { might: { shift: 'd20' } } } });
    // lend-assistance.mjs#canAssistWithSkill lifts the rank gate on ruleAssist(...).anyRank.
    const anyRank = (helper, ally) => ruleAssist(helper, ally, 'might').anyRank;
    expect(anyRank(miniCon, owner)).toBe(true);
    expect(anyRank(owner, miniCon)).toBe(true);
    expect(anyRank(miniCon, pet)).toBe(true);
    expect(anyRank(pet, owner)).toBe(false);
    expect(anyRank(stranger, owner)).toBe(false);
    expect(anyRank(owner, stranger)).toBe(false);
    miniCon.token.center.x = 120 * 20;
    expect(anyRank(miniCon, owner)).toBe(false);
  });

  test('Pack Attack: an attack against a target the partner attacked this round gets an Edge (owner and pet)', async () => {
    const owner = makeActor([packItem('packAttack')], { name: 'Owner' });
    const pet = companion(owner, 'pet', { name: 'Pet' });
    const foe = makeActor([], { name: 'Foe' });
    const roll = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    expect(ruleRollSources(pet, foe, roll).sources).toEqual([]);
    await noteRolledAgainst(owner, [foe], true);
    expect(ruleRollSources(pet, foe, roll).sources[0]).toMatchObject({ label: 'Pack Attack', edge: true });
    expect(ruleRollSources(pet, foe, { rolledSkill: 'might' }).sources).toEqual([]);
    expect(ruleRollSources(owner, foe, roll).sources).toEqual([]);
    await noteRolledAgainst(pet, [foe], true);
    expect(ruleRollSources(owner, foe, roll).sources[0]).toMatchObject({ edge: true });
    // A Skill Test against the target isn't an attack.
    const other = makeActor([], { name: 'Other' });
    await noteRolledAgainst(owner, [other], false);
    expect(ruleRollSources(pet, other, roll).sources).toEqual([]);
  });

  test('Automatic Harmonics: the drone gets an Edge against a target its owner rolled against this round, once per encounter', async () => {
    const owner = makeActor([packItem('harmonics')], { name: 'Owner' });
    const drone = companion(owner, 'drone', { name: 'Drone' });
    const pet = companion(owner, 'pet', { name: 'Pet' });
    const foe = makeActor([], { name: 'Foe' });
    expect(ruleRollSources(drone, foe, { rolledSkill: 'technology' }).sources).toEqual([]);
    await noteRolledAgainst(owner, [foe], false);
    const out = ruleRollSources(drone, foe, { rolledSkill: 'technology' });
    expect(out.sources[0]).toMatchObject({ label: 'Automatic Harmonics', edge: true });
    expect(out.consumes).toEqual([expect.objectContaining({ ext: 'rulesLimit', actorUuid: owner.uuid })]);
    expect(ruleRollSources(pet, foe, { rolledSkill: 'technology' }).sources).toEqual([]);
  });

  test('Ambush Deployment: owner and Mini-Con get an Edge attacking an enemy adjacent to the owner, the round a Mini-Con deployed', () => {
    global.game.combat = { id: 'c1', round: 2, turn: 0, started: true };
    const owner = makeActor([packItem('ambush')], { name: 'Owner', token: tokenAt(0, 0) });
    const mini = companion(owner, 'miniCon', { name: 'Mini', flags: { miniCon: { docked: false, deployedRound: { combatId: 'c1', round: 2 } } } });
    const pet = companion(owner, 'pet', { name: 'Pet' });
    const foe = makeActor([], { name: 'Foe', token: tokenAt(100, 0) });
    const roll = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    expect(ruleRollSources(owner, foe, roll).sources[0]).toMatchObject({ label: 'Ambush Deployment', edge: true });
    expect(ruleRollSources(mini, foe, roll).sources[0]).toMatchObject({ edge: true });
    expect(ruleRollSources(pet, foe, roll).sources).toEqual([]);
    foe.token.center.x = 200;
    expect(ruleRollSources(owner, foe, roll).sources).toEqual([]);
    foe.token.center.x = 100;
    global.game.combat.round = 3;
    expect(ruleRollSources(owner, foe, roll).sources).toEqual([]);
  });

  test('Shield Companion: +1 Toughness and Evasion against attacks while the deployed Mini-Con is adjacent', () => {
    const owner = makeActor([], { name: 'Owner', token: tokenAt(0, 0) });
    const mini = companion(owner, 'miniCon', { name: 'Mini', items: [packItem('shieldCompanion')], token: tokenAt(100, 0), flags: { miniCon: { docked: false } } });
    const foe = makeActor([], { name: 'Foe' });
    const roll = { item: { type: 'weaponEffect', system: {} }, isAttack: true };
    expect(extDefenseAdjust(foe, owner, 'toughness', roll)).toBe(1);
    expect(extDefenseAdjust(foe, owner, 'evasion', roll)).toBe(1);
    expect(extDefenseAdjust(foe, owner, 'willpower', roll)).toBe(0);
    mini.flags.essence20.miniCon.docked = true;
    expect(extDefenseAdjust(foe, owner, 'toughness', roll)).toBe(0);
    mini.flags.essence20.miniCon.docked = false;
    mini.token.center.x = 300;
    expect(extDefenseAdjust(foe, owner, 'toughness', roll)).toBe(0);
  });

  test("Acid Sacs: the pet's hits offer 1 Acid damage - held by the pet, or by its owner for a pet", () => {
    const foe = makeActor([], { name: 'Foe' });
    const fist = makeItem({ type: 'weaponEffect', system: { damageValue: 2 } });
    const hit = attacker => {
      const result = { damageValue: 2, damageType: 'blunt' };
      hitRiderOnAttack(attacker, foe, result, { itemUuid: fist.uuid }, { damageBonusNote: jest.fn() });
      return result.riderOptions ?? [];
    };

    const owner = makeActor([], { name: 'Owner' });
    const pet = companion(owner, 'pet', { name: 'Pet', items: [packItem('acidSacs', { source: C('wtnv_citizens_guide', '8sUOMdsOyxfF0o1s') })] });
    expect(hit(pet)).toEqual([expect.objectContaining({ key: 'acidSacs', damageValue: 1, damageType: 'acid' })]);
    expect(hit(owner)).toEqual([]);

    const keeper = makeActor([packItem('acidSacs', { source: C('wtnv_citizens_guide', '8sUOMdsOyxfF0o1s') })], { name: 'Keeper' });
    const hound = companion(keeper, 'pet', { name: 'Hound' });
    const drone = companion(keeper, 'drone', { name: 'Drone' });
    expect(hit(hound)).toEqual([expect.objectContaining({ key: 'acidSacs', damageValue: 1 })]);
    expect(hit(drone)).toEqual([]);
    expect(hit(keeper)).toEqual([]);
  });

  // Book check (effects): "a target it is grappling" - the pet's own Grapple / Maneuver hit marks what it holds (the old
  // `grappling` flag was never written).
  test('Constrictor: at its turn start the pet deals 1 Blunt to the grappled creature it holds', async () => {
    const owner = makeActor([], { name: 'Owner' });
    const prey = makeActor([], { name: 'Prey', statuses: ['grappled'] });
    const bystander = makeActor([], { name: 'Bystander', statuses: ['grappled'] });
    const snake = companion(owner, 'pet', { name: 'Snake', items: [packItem('constrictor')] });
    await fireTriggers(snake, 'turnStart');
    expect(dealt).toEqual([]);
    const bite = { name: 'Bite', type: 'weaponEffect', system: { damageType: 'sharp' }, flags: {} };
    await fireTriggers(snake, 'hit', { roll: { item: bite, isAttack: true }, outcome: 'success', targets: [bystander], facts: { results: [{ success: true }] } });
    const squeeze = { name: 'Squeeze', type: 'weaponEffect', system: { damageType: 'grapple' }, flags: {} };
    await fireTriggers(snake, 'hit', { roll: { item: squeeze, isAttack: true }, outcome: 'success', targets: [prey], facts: { results: [{ success: true }] } });
    await fireTriggers(snake, 'turnStart');
    expect(dealt).toEqual([{ name: 'Prey', amount: 1, type: 'blunt' }]);
    prey.statuses.clear();
    await fireTriggers(snake, 'turnStart');
    expect(dealt).toHaveLength(1);
  });

  test('Telemetry Data: Night Vision Goggles (and a Laser Designator from 15th level) on the drone, once', async () => {
    const perk = packItem('telemetry');
    const owner = makeActor([perk], { name: 'Owner', system: { level: 15 } });
    await use(perk);
    expect(perk.flags.essence20.granted).toBeUndefined();
    const drone = companion(owner, 'drone', { name: 'Drone' });
    await use(perk);
    expect(granted(drone, perk).map(i => i.name)).toEqual(['Night Vision Goggles', 'Laser Designator']);
    expect(available(perk)).toBe(false);

    const low = packItem('telemetry');
    const novice = makeActor([low], { name: 'Novice', system: { level: 5 } });
    const own = companion(novice, 'drone', { name: 'Own' });
    await use(low);
    expect(granted(own, low).map(i => i.name)).toEqual(['Night Vision Goggles']);
  });

  test('Terminal Guidance: the drone deals half its Health (rounded up) to the target and is destroyed', async () => {
    const perk = packItem('terminal');
    const owner = makeActor([perk], { name: 'Owner' });
    const foe = makeActor([], { name: 'Foe' });
    target(foe);
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    const drone = companion(owner, 'drone', { name: 'Drone', system: { health: { max: 6, value: 5 } } });
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(dealt).toEqual([{ name: 'Foe', amount: 3, type: 'blunt' }]);
    expect(drone.system.health.value).toBe(0);
    expect(conditions).toEqual([{ name: 'Drone', status: 'defeated', rounds: 0 }]);
  });

  test('Buzz The Tower: the drone rolls the chosen Skill against the chosen Defense; a success flusters the target (Snag), once per scene', async () => {
    const perk = packItem('buzz');
    const owner = makeActor([perk], { name: 'Owner' });
    const drone = companion(owner, 'drone', { name: 'Drone' });
    const foe = makeActor([], { name: 'Foe' });
    target(foe);
    chooses = ['Deception', 'Cleverness'];
    rolls = [{ success: false }];
    await use(perk);
    expect(rollsMade).toEqual([{ name: 'Drone', skill: 'deception', dif: 14 }]);
    expect(ruleRollSources(foe, null, { rolledSkill: 'might' }).sources).toEqual([]);
    expect(available(perk)).toBe(false);

    const again = packItem('buzz');
    const other = makeActor([again], { name: 'Other' });
    companion(other, 'drone', { name: 'Drone 2' });
    chooses = ['Driving', 'Willpower'];
    await use(again);
    expect(rollsMade.at(-1)).toEqual({ name: 'Drone 2', skill: 'driving', dif: 13 });
    expect(ruleRollSources(foe, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ snag: true });
    expect(drone).toBeTruthy();
  });

  test('Enhanced Sensors: the Mini-Con (or the holder, when it is one) gains Acute Sense, once', async () => {
    const perk = packItem('sensors');
    const owner = makeActor([perk], { name: 'Owner' });
    await use(perk);
    expect(perk.flags.essence20.granted).toBeUndefined();
    const mini = companion(owner, 'miniCon', { name: 'Mini' });
    await use(perk);
    expect(granted(mini, perk).map(i => i.name)).toEqual(['Acute Sense']);
    expect(available(perk)).toBe(false);

    const own = packItem('sensors');
    const self = companion(owner, 'miniCon', { name: 'Self', items: [own] });
    await use(own);
    expect(granted(self, own).map(i => i.name)).toEqual(['Acute Sense']);
  });
});

/* -------------------------------------------- */
/*  Foraging, kitbashing, crafting               */
/* -------------------------------------------- */

describe('foraging, kitbashing and crafting', () => {
  test('Forage: a kit of a tier the level opens, Survival vs its DIF (Edge with Forage Familiarity); a new one replaces the old', async () => {
    const perk = packItem('forage');
    const actor = makeActor([perk], { system: { level: 6 } });
    picks = ['Standard Medicine Kit'];
    await use(perk);
    expect(offered[0]).toEqual(['Standard Medicine Kit']);
    expect(rollsMade).toEqual([{ name: 'Hero', skill: 'survival', dif: 0 }]);
    expect(granted(actor, perk).map(i => [i.name, i.flags.essence20.foraged])).toEqual([['Standard Medicine Kit', true]]);

    actor.system.level = 13;
    give(actor, makeItem({ name: 'Forage Familiarity', type: 'perk', flags: { core: { sourceId: C('ferocious_fighters', '2MvQyj4AUcr4QOtU') } } }));
    picks = ['Limited Burglary Kit'];
    await use(perk);
    expect(offered[1]).toEqual(['Standard Medicine Kit', 'Limited Burglary Kit', 'Restricted Climbing Kit']);
    expect(rollsMade[1]).toEqual({ name: 'Hero', skill: 'survival', dif: 10, edge: true });
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Limited Burglary Kit']);

    rolls = [{ success: false }];
    picks = ['Restricted Climbing Kit'];
    await use(perk);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Limited Burglary Kit']);
  });

  test('Environmental Weapon: a melee (or Reach) weapon, attacked with Survival; Weapon Forage needs Forage and may add Salvaged', async () => {
    const perk = packItem('environmental');
    const actor = makeActor([perk], { system: { level: 7 } });
    picks = ['Club'];
    await use(perk);
    expect(offered[0]).toEqual(['Club', 'Whip', 'Power Staff']);
    expect(granted(actor, perk)[0].flags.essence20).toMatchObject({ foraged: true, attackSkill: 'survival' });

    const weaponForage = packItem('weaponForage');
    const other = makeActor([weaponForage], { system: { level: 1 } });
    await use(weaponForage);
    expect(offered).toHaveLength(1);
    give(other, makeItem({ name: 'Forage', type: 'perk', flags: { core: { sourceId: C('gi_joe_crb', 'QXpG3NuwaFgbdc0x') } } }));
    picks = ['Plain Rifle'];
    chooses = ['Yes'];
    await use(weaponForage);
    const [rifle] = granted(other, weaponForage);
    expect(rifle.name).toBe('Plain Rifle');
    const salvaged = other.items.contents.find(i => i.name == 'Salvaged');
    expect(salvaged.flags.essence20.parentId).toBe(rifle.id);
    // Foraging a weapon replaces the foraged weapon (whichever Perk foraged it).
    picks = ['Club'];
    chooses = ['No'];
    await use(weaponForage);
    expect(other.items.contents.filter(i => i.flags.essence20.foraged).map(i => i.name)).toEqual(['Club']);
  });

  test('Quickbash: equipment or a weapon upgrade as a Free action, Technology vs its DIF, this turn (the next too on a Critical Success)', async () => {
    const perk = packItem('quickbash');
    const actor = makeActor([perk]);
    global.game.combat = { id: 'c1', round: 2, turn: 0, started: true, turns: [{ actor }] };
    chooses = ['Equipment', 'Weapon'];
    picks = ['Whip'];
    await use(perk);
    expect(offered[0]).not.toContain('Cannon');
    expect(pay).toHaveBeenCalledWith('free');
    expect(rollsMade).toEqual([{ name: 'Hero', skill: 'technology', dif: 10 }]);
    expect(granted(actor, perk)[0].flags.essence20.rulesExpiry).toMatchObject({ until: 'endOfTurn' });

    const rifle = give(actor, makeItem({ name: 'Rifle', type: 'weapon', system: {} }));
    chooses = ['Upgrade'];
    picks = ['Rifle', 'Scope'];
    rolls = [{ success: true, crit: true }];
    await use(perk);
    const scope = actor.items.contents.find(i => i.name == 'Scope');
    expect(scope.flags.essence20).toMatchObject({ parentId: rifle.id, temporary: expect.objectContaining({ kind: 'nextTurn' }) });
  });

  test('Manifest Enhancement: a weapon upgrade on a melee weapon until the end of the turn, a tier its Perks open, once per round', async () => {
    const perk = packItem('manifestEnhancement');
    const actor = makeActor([perk]);
    const sword = give(actor, makeItem({ name: 'Sword', type: 'weapon', system: {} }));
    give(actor, makeItem({ name: 'Slash', type: 'weaponEffect', flags: { essence20: { parentId: sword.id } }, system: { classification: { style: 'melee' } } }));
    give(actor, makeItem({ name: 'Gun', type: 'weapon', system: {} }));
    global.game.combat = { id: 'c1', round: 2, turn: 0, started: true, turns: [{ actor }] };
    picks = ['Sword', 'Scope'];
    await use(perk);
    expect(offered[0]).toEqual(['Sword']);
    expect(offered[1]).toEqual(['Salvaged']);
    expect(actor.items.contents.find(i => i.name == 'Scope')).toBeUndefined();
    give(actor, makeItem({ name: 'Instruments of Destruction', type: 'perk', flags: { core: { sourceId: C('tf_crb', 'ybrluGy9norsyiMm') } } }));
    picks = ['Sword', 'Restricted Barrel'];
    await use(perk);
    expect(offered[3]).toEqual(['Scope', 'Salvaged', 'Restricted Barrel']);
    expect(pay).toHaveBeenCalledWith('free');
    expect(actor.items.contents.find(i => i.name == 'Restricted Barrel').flags.essence20).toMatchObject({ parentId: sword.id, temporary: expect.objectContaining({ kind: 'turn' }) });
    expect(available(perk)).toBe(false);
    global.game.combat.round = 3;
    expect(available(perk)).toBe(true);
  });

  test('Brainstorm: up to three; Standard needs no test, Limited DIF 10 ... Unique a Story Point and DIF 30; the item ends on a Fumble', async () => {
    const perk = packItem('brainstorm');
    const actor = makeActor([perk]);
    chooses = ['Weapon'];
    picks = ['Club'];
    await use(perk);
    expect(rollsMade).toEqual([]);
    expect(granted(actor, perk)[0].flags.essence20).toMatchObject({ brainstorm: true, endsOnFumble: true });
    chooses = ['Weapon'];
    picks = ['Whip'];
    rolls = [{ success: false }];
    await use(perk);
    expect(rollsMade).toEqual([{ name: 'Hero', skill: 'technology', dif: 10 }]);
    expect(granted(actor, perk)).toHaveLength(1);
    chooses = ['Gear'];
    picks = ['Unique Gadget'];
    await use(perk);
    expect(rollsMade.at(-1)).toEqual({ name: 'Hero', skill: 'technology', dif: 30 });
    chooses = ['Weapon'];
    picks = ['Prototype Gun'];
    await use(perk);
    expect(rollsMade.at(-1).dif).toBe(20);
    expect(granted(actor, perk)).toHaveLength(3);
    await use(perk);
    expect(offered).toHaveLength(4);
  });

  test('Integrated Specialized Weapon: every drone weapon goes, then one a step more available than the drone, Integrated, once', async () => {
    const upgrade = packItem('droneWeapon');
    const drone = makeActor([upgrade], { type: 'companion', system: { type: 'drone', availability: 'standard' } });
    const old = give(drone, makeItem({ name: 'Old Gun', type: 'weapon', flags: { essence20: { droneWeapon: true } }, system: {} }));
    give(drone, makeItem({ name: 'Old Shot', type: 'weaponEffect', flags: { essence20: { parentId: old.id } }, system: {} }));
    picks = ['Whip'];
    await use(upgrade);
    expect(offered[0]).toEqual(['Whip', 'Cannon']);
    expect(drone.items.contents.map(i => i.name)).toEqual([upgrade.name, 'Whip']);
    expect(granted(drone, upgrade)[0]).toMatchObject({ system: expect.objectContaining({ integrated: true }), flags: { essence20: expect.objectContaining({ droneWeapon: true }) } });
    expect(available(upgrade)).toBe(false);
  });

  test.each(['inventive1', 'inventive2'])('%s: a low-damage sidearm / power weapon replaces the old one, heavier armor, or a free upgrade; once', async key => {
    const perk = packItem(key);
    const actor = makeActor([perk]);
    const old = give(actor, makeItem({ name: 'Old Sidearm', type: 'weapon', system: { classification: { size: 'sidearm' } } }));
    give(actor, makeItem({ name: 'Old Shot', type: 'weaponEffect', flags: { essence20: { parentId: old.id } }, system: {} }));
    chooses = ['Replace your Energy-based Sidearm'];
    picks = ['Hand Laser'];
    await use(perk);
    expect(offered[0]).toEqual(['Hand Laser']);
    expect(actor.items.contents.map(i => i.name)).toEqual([perk.name, 'Hand Laser']);
    expect(available(perk)).toBe(false);

    const again = packItem(key);
    const armored = makeActor([again], { name: 'Armored', system: { trained: { armors: { light: true, medium: true } } } });
    chooses = ['Heavier armor'];
    await use(again);
    expect(armored.system.trained.armors).toEqual({ light: true, medium: true, heavy: true });
    expect(toughness).toContain('Armored');
  });

  test.each(['multifaceted', 'multifacetedHangUp'])('%s: a Perk of your Faction set aside (effects off) for a Perk of another Faction; the last swap goes', async key => {
    const perk = packItem(key);
    const faction = makeItem({ name: 'Own Faction', type: 'faction', flags: { core: { sourceId: C('fac', 'OwnFactionAAAAAA') } }, system: { items: { a: { uuid: C('fac', 'PerkAAAAAAAAAAAA'), name: 'Perk A', type: 'perk' } } } });
    const own = makeItem({ name: 'Perk A', type: 'perk', flags: { core: { sourceId: C('fac', 'PerkAAAAAAAAAAAA') } }, effects: [{ id: 'e1', disabled: false }] });
    const actor = makeActor([perk, faction, own, makeItem({ name: 'Other Perk', type: 'perk' })]);
    picks = ['Perk A', 'Other Faction', 'Perk B'];
    await use(perk);
    expect(offered[0]).toEqual(['Perk A']);
    expect(offered[1]).toEqual(['Other Faction']);
    expect(offered[2]).toEqual(['Perk B', 'Perk C']);
    expect(own.effects[0].disabled).toBe(true);
    expect(own.flags.essence20.setAside).toBe(true);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Perk B']);
    picks = ['Perk A', 'Other Faction', 'Perk C'];
    await use(perk);
    expect(actor.items.contents.filter(i => i.flags.essence20.multifacetedSwap).map(i => i.name)).toEqual(['Perk C']);
  });

  test('Volatile Delivery: once per scene, a Free action - one element grenade of the Energy Affinity type (fire by default), for the scene', async () => {
    const perk = packItem('volatile');
    const actor = makeActor([perk]);
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    const [grenade] = granted(actor, perk);
    expect(grenade.system).toMatchObject({ quantity: 1, elementChoice: 'fire' });
    expect(grenade.flags.essence20.rulesExpiry).toMatchObject({ until: 'scene' });
    expect(available(perk)).toBe(false);

    const other = packItem('volatile');
    const elementalist = makeActor([other, makeItem({ name: 'Energy Affinity', type: 'perk', flags: { core: { sourceId: C('decepticon_directive', 'DgFY0ZmAtClAobiA') }, essence20: { rules: { choices: { element: 'cold' } } } }, system: { rules: [{ type: 'ChoiceSet', key: 'element', from: 'element', required: true, legacy: 'system.choice' }] } })]);
    await use(other);
    expect(granted(elementalist, other)[0].system.elementChoice).toBe('cold');
  });

  test('Cordial / Rough and Takes No Guff: Role Essence increases redirected', async () => {
    const { ruleEssenceRedirect } = await import('./plugins/resources/uses-grant-pieces.mjs');
    const cordial = packItem('cordial');
    const actor = makeActor([cordial]);
    expect(ruleEssenceRedirect(actor, { name: 'Explorer' }, 'smarts')).toBeNull();
    picks = ['smarts'];
    await use(cordial);
    expect(cordial.flags.essence20.rules.choices.essence).toBe('smarts');
    expect(ruleEssenceRedirect(actor, { name: 'Explorer' }, 'smarts')).toBe('social');
    expect(ruleEssenceRedirect(actor, { name: 'Explorer' }, 'speed')).toBeNull();
    expect(available(cordial)).toBe(false);

    const rough = packItem('rough');
    const officer = makeActor([rough]);
    expect(ruleEssenceRedirect(officer, { name: 'Officer' }, 'speed')).toBeNull();
    await use(rough);
    expect(ruleEssenceRedirect(officer, { name: 'Officer' }, 'speed')).toBe('strength');
    expect(ruleEssenceRedirect(officer, { name: 'Infantry' }, 'speed')).toBeNull();
    await use(rough);
    expect(ruleEssenceRedirect(officer, { name: 'Officer' }, 'speed')).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Kits, consumables, help, carrying            */
/* -------------------------------------------- */

describe('kits, consumables, help and carrying', () => {
  test('Med Kit: a Standard action heals 1 (2 with Science (Medicine)) on the target or yourself, ten uses, then restock', async () => {
    const kit = packItem('medKit');
    const actor = makeActor([kit], { system: { health: { value: 2, max: 6 }, skills: { science: { specializations: { medicine: { name: 'Medicine' } } } } } });
    await use(kit);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(actor.system.health.value).toBe(4);
    expect(kit.flags.essence20.usesLeft).toBe(9);
    const ally = makeActor([], { name: 'Ally', system: { health: { value: 5, max: 6 } } });
    target(ally);
    kit.flags.essence20.usesLeft = 1;
    await use(kit);
    expect(ally.system.health.value).toBe(6);
    expect(kit.flags.essence20).toMatchObject({ usesLeft: 0, kitSpent: true });
    await use(kit);
    expect(kit.flags.essence20).toMatchObject({ usesLeft: 10, kitSpent: false });
    // Without Medicine, 1 Health; doubled when handed over this round by a friend with Take Mine.
    const plain = packItem('medKit', { flags: { givenBy: { actorUuid: 'Actor.friend', combatId: 'c1', round: 1 } } });
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [] };
    const medic = makeActor([plain], { name: 'Medic', system: { health: { value: 1, max: 6 } } });
    global.game.user.targets = new Set();
    await use(plain);
    expect(medic.system.health.value).toBe(3);
  });

  test('Automated Repair Kit: heals 2 and is used up; Imaginary Corn: ↑1 on Strength tests for the scene, then gone', async () => {
    const ark = packItem('repairKit', { data: { system: { ...fromPack(FILES.repairKit).system, quantity: 1 } } });
    const bot = makeActor([ark], { system: { health: { value: 1, max: 6 } } });
    await use(ark);
    expect(bot.system.health.value).toBe(3);
    expect(bot.items.contents).not.toContain(ark);

    const { kitSources } = await import('../mechanics/resources/kits.mjs');
    const corn = packItem('corn', { data: { system: { ...fromPack(FILES.corn).system, quantity: 2 } } });
    const eater = makeActor([corn]);
    await use(corn);
    expect(corn.system.quantity).toBe(1);
    expect(kitSources(eater, 'athletics', null, false).sources[0]).toMatchObject({ shiftUp: 1 });
    expect(kitSources(eater, 'technology', null, false).sources).toEqual([]);
  });

  test('Ally Awareness: once per scene a Free action banks a Lend Assistance ↑1 on the picked Skill; allies reach it from 5x as far', async () => {
    const perk = packItem('allyAwareness');
    const actor = makeActor([perk], { system: { skills: { athletics: { shift: 'd4' }, technology: { shift: 'd6' } } } });
    picks = ['technology'];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    expect(actor.flags.essence20.pendingLendAssistanceShift).toMatchObject({ skill: 'technology', shiftUp: 1, assisterUuid: actor.uuid });
    expect(available(perk)).toBe(false);

    const { getNearbyAllyTokens } = await import('../mechanics/combat/nearby-allies.mjs');
    const leader = makeActor([], { name: 'Leader', token: tokenAt(0, 0) });
    const aware = makeActor([packItem('allyAwareness')], { name: 'Aware', token: tokenAt(20 * 40, 0) });
    const plain = makeActor([], { name: 'Plain', token: tokenAt(0, 20 * 40) });
    onCanvas(leader, aware, plain);
    expect(getNearbyAllyTokens(leader, 10).map(token => token.actor.name)).toEqual(['Aware']);
  });

  test('Assistant: the pet lends assistance as a Free action once it has a Favorite Command', async () => {
    const perk = packItem('assistantGij');
    const pet = makeActor([perk], { name: 'Pet', type: 'companion', system: { type: 'pet' } });
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    give(pet, makeItem({ name: 'Favorite Command', type: 'perk', flags: { core: { sourceId: C('mlp_crb', 'rPnaWCU06W8c0Zua') } } }));
    lendAssistanceSkill.mockResolvedValueOnce(true);
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    expect(lendAssistanceSkill).toHaveBeenCalledWith(pet);
    expect(packItem('assistantMlp').system.rules).toEqual(perk.system.rules);
  });

  test('Bomber / Medicine Cabinet: up to six hands of explosives / poisons are carried outside the hands', async () => {
    const { extraCarriedHands } = await import('../mechanics/resources/kits.mjs');
    const grenade = makeItem({ name: 'Grenade', type: 'weapon', system: { quantity: 8 } });
    const blast = makeItem({ name: 'Blast', type: 'weaponEffect', flags: { essence20: { parentId: grenade.id } }, system: { classification: { style: 'explosive' } } });
    const vial = makeItem({ name: 'Vial', type: 'weapon', system: { quantity: 2, isPoison: true } });
    const actor = makeActor([grenade, blast, vial, packItem('bomber')]);
    const carried = [{ item: grenade, hands: 1 }, { item: vial, hands: 1 }];
    expect(extraCarriedHands(actor, carried)).toBe(6);
    give(actor, packItem('medicineCabinet'));
    expect(extraCarriedHands(actor, carried)).toBe(8);
  });

  test('Handy Scrounger: scrounge DIF -5 and the tier-up roll; Stretching Resources: the keep roll', async () => {
    const { scroungeDif } = await import('../mechanics/resources/kits.mjs');
    const { ruleKitModifier } = await import('./plugins/resources/kit-rules.mjs');
    const scrounger = makeActor([packItem('handyScrounger')]);
    expect(scroungeDif(scrounger, 'limited')).toBe(5);
    expect(scroungeDif(scrounger, 'standard')).toBe(0);
    expect(ruleKitModifier(scrounger, 'upgradeRoll')).toBe(true);
    expect(ruleKitModifier(scrounger, 'keepRoll')).toBe(false);
    const stretcher = makeActor([packItem('stretching')]);
    expect(scroungeDif(stretcher, 'limited')).toBe(10);
    expect(ruleKitModifier(stretcher, 'keepRoll')).toBe(true);
  });

  test('Kitted Out: a Restricted Technology kit of the picked Specialization, once; and it may re-specialize kits', async () => {
    global.CONFIG.E20.standardSpecializations = { gij: { technology: ['Hacking', 'Demolitions'] }, tf: { technology: ['Hacking', 'Robotics'] } };
    const perk = packItem('kittedOut');
    const actor = makeActor([perk]);
    picks = ['Robotics'];
    await use(perk);
    expect(offered[0]).toEqual(['Demolitions', 'Hacking', 'Robotics']);
    expect(granted(actor, perk)[0]).toMatchObject({ name: 'Restricted Technology (Robotics) Kit', flags: { essence20: { kit: { tier: 'restricted', skill: 'technology', spec: 'Robotics' } } } });
    expect(available(perk)).toBe(false);
    const { ruleKitModifier } = await import('./plugins/resources/kit-rules.mjs');
    expect(ruleKitModifier(actor, 'respecialize')).toBe(true);
  });

  test('Loader: carry (+2 Brawn) and shove ↑2 in Alt Mode or as a carrier; +1 Toughness used as a shield in Bot Mode', async () => {
    const { carryPercent } = await import('../mechanics/resources/kits.mjs');
    const { ruleBrawnBonus } = await import('./plugins/effects/brawn-requirement.mjs');
    const loader = packItem('loader');
    const actor = makeActor([loader], { system: { isTransformed: true, skills: { brawn: { shift: 'd6' } } } });
    expect(carryPercent(actor)).toBe(150);
    expect(ruleBrawnBonus(actor, 'requirement')).toBe(0);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might', isShove: true }).sources[0]).toMatchObject({ label: 'Loader', shiftUp: 2 });
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
    actor.system.isTransformed = false;
    await use(loader);
    expect(loader.flags.essence20.rules.toggles.shield).toBe(true);
    expect(carryPercent(actor)).toBe(75);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might', isShove: true }).sources).toEqual([]);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(13);
  });

  test('Protomatter Injection Layer: the first three hits of 2+ lose 1; replenished for 2 Energon and a DIF 12 Technology test', async () => {
    const { damageReduction } = await import('./plugins/combat/damage-reduction.mjs');
    const layer = packItem('protomatter');
    const actor = makeActor([layer], { system: { energon: { normal: { value: 1, max: 5 } } } });
    expect(await damageReduction(actor, 1, 'blunt')).toBe(1);
    expect(await damageReduction(actor, 3, 'blunt')).toBe(2);
    await damageReduction(actor, 2, 'blunt');
    await damageReduction(actor, 2, 'blunt');
    expect(await damageReduction(actor, 2, 'blunt')).toBe(2);
    expect(ChatMessage.create).not.toHaveBeenCalled();
    await use(layer);
    expect(rollsMade).toEqual([]);
    actor.system.energon.normal.value = 3;
    await use(layer);
    expect(rollsMade).toEqual([{ name: 'Hero', skill: 'technology', dif: 12 }]);
    expect(actor.system.energon.normal.value).toBe(1);
    expect(await damageReduction(actor, 2, 'blunt')).toBe(1);
  });
});

/* -------------------------------------------- */
/*  Target riders, Adept Armaments, readers      */
/* -------------------------------------------- */

describe('target riders, Adept Armaments and small readers', () => {
  const attackRoll = item => ({ item, isAttack: true });

  test('On My Mark!: off your own turn (a Contingency) your Mark Target\'s Defenses are 5 lower', () => {
    const actor = makeActor([packItem('onMyMark')], { name: 'Demo' });
    const foe = makeActor([], { name: 'Foe' });
    // The Mark Target Use rule's per-setter mark (items/rolls/mark-target.mjs#checkMarkTarget reads it).
    foe.flags.essence20.ruleMarks = { [`markTarget--${actor.id}`]: { by: actor.uuid, until: 'scene', stamp: { epoch: 1 } } };
    const roll = attackRoll({ type: 'weaponEffect', system: {} });
    expect(extDefenseAdjust(actor, foe, 'toughness', roll)).toBe(0);
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, combatant: { actor: foe }, turns: [] };
    expect(extDefenseAdjust(actor, foe, 'toughness', roll)).toBe(-5);
    expect(extDefenseAdjust(actor, foe, 'willpower', roll)).toBe(-5);
    expect(extDefenseAdjust(actor, makeActor([], { name: 'Other' }), 'toughness', roll)).toBe(0);
    global.game.combat.combatant = { actor };
    expect(extDefenseAdjust(actor, foe, 'toughness', roll)).toBe(0);
    foe.flags.essence20.ruleMarks[`markTarget--${actor.id}`].stamp.epoch = 0;
    global.game.combat.combatant = { actor: foe };
    expect(extDefenseAdjust(actor, foe, 'toughness', roll)).toBe(0);
  });

  test('Co-Dependent: the chosen creature on the scene with any Condition (but Morphed, Cover...) gives ↓1 on every test', async () => {
    const hangUp = packItem('coDependent');
    const actor = makeActor([hangUp], { name: 'Me', token: tokenAt(0, 0) });
    const friend = makeActor([], { name: 'Friend', token: tokenAt(100, 0), statuses: ['morphed'] });
    onCanvas(actor, friend);
    target(friend);
    await use(hangUp);
    expect(hangUp.flags.essence20.rules.choices.bond).toBe(friend.uuid);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
    friend.statuses.add('grappled');
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ label: 'Co-Dependent', shiftDown: 1 });
    onCanvas(actor);
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources).toEqual([]);
  });

  test('Reveal Weakness: a Standard action marks the target for the combat; hits on it by anyone deal +1, once', async () => {
    const perk = packItem('revealWeakness');
    const actor = makeActor([perk], { name: 'Scout' });
    const other = makeActor([packItem('revealWeakness')], { name: 'Other Scout' });
    const ally = makeActor([], { name: 'Ally' });
    const foe = makeActor([], { name: 'Foe' });
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [] };
    target(foe);
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(foe.flags.essence20.ruleMarks.revealWeakness).toMatchObject({ by: actor.uuid, until: 'combat' });
    const fist = makeItem({ type: 'weaponEffect', system: { damageValue: 2 } });
    const notes = [];
    const hit = (attacker, victim) => hitRiderOnAttack(attacker, victim, { damageValue: 2, damageType: 'blunt' }, { itemUuid: fist.uuid }, { damageBonusNote: (result, amount, label) => notes.push([attacker.name, amount, label]) });
    hit(ally, foe);
    hit(actor, foe);
    hit(ally, makeActor([], { name: 'Someone' }));
    expect(notes).toEqual([['Ally', 1, 'Reveal Weakness'], ['Scout', 1, 'Reveal Weakness']]);
    // A second Scout marking the same creature doesn't double it.
    const otherPerk = other.items.contents[0];
    await use(otherPerk);
    notes.length = 0;
    hit(ally, foe);
    expect(notes).toEqual([['Ally', 1, 'Reveal Weakness']]);
  });

  test('Highly Effective / Flurry of Attacks: ↑1 with an Adept Armament\'s other attacks; ↑1 per other Adept Armament attacked with this turn', async () => {
    const actor = makeActor([packItem('highlyEffective'), packItem('flurry')], { name: 'Trooper' });
    const rifle = give(actor, makeItem({ name: 'Rifle', type: 'weapon', flags: { essence20: { adeptArmament: true } }, system: {} }));
    const shot = give(actor, makeItem({ name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} }));
    const burst = give(actor, makeItem({ name: 'Burst', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} }));
    const pistol = give(actor, makeItem({ name: 'Pistol', type: 'weapon', flags: { essence20: { adeptArmament: true } }, system: {} }));
    const pop = give(actor, makeItem({ name: 'Pop', type: 'weaponEffect', flags: { essence20: { parentId: pistol.id } }, system: {} }));
    const sources = item => ruleRollSources(actor, null, attackRoll(item)).sources.map(s => [s.label, s.shiftUp]);
    expect(sources(shot)).toEqual([]);
    expect(sources(burst)).toEqual([['Highly Effective', 1]]);
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [] };
    await fireTriggers(actor, 'afterRoll', { roll: attackRoll(shot), outcome: 'success', vars: { itemUuid: shot.uuid } });
    expect(actor.flags.essence20.flurryTurn).toMatchObject({ combatId: 'c1', weapons: [rifle.id] });
    expect(sources(pop)).toEqual([['Flurry of Attacks', 1]]);
    expect(sources(shot)).toEqual([]);
    await fireTriggers(actor, 'afterRoll', { roll: attackRoll(pop), outcome: 'failure', vars: { itemUuid: pop.uuid } });
    expect(sources(burst)).toEqual([['Highly Effective', 1], ['Flurry of Attacks', 1]]);
    global.game.combat.turn = 1;
    expect(sources(pop)).toEqual([]);
  });

  test('Fanatic: near an allied commander (or Word of Unicron holder), the net downshift never passes ↓2', async () => {
    const { ruleShiftCap } = await import('./plugins/rolls/shift-cap.mjs');
    const actor = makeActor([packItem('fanatic')], { name: 'Fanatic', token: tokenAt(0, 0, { disposition: -1 }) });
    expect(ruleShiftCap(actor, 0, 4)).toBeNull();
    const boss = makeActor([], { name: 'Boss', token: tokenAt(100, 0, { disposition: -1 }), system: { creatureTags: 'commander' } });
    onCanvas(actor, boss);
    expect(ruleShiftCap(actor, 0, 4)).toMatchObject({ label: 'Fanatic', shiftUp: 2 });
    expect(ruleShiftCap(actor, 1, 4)).toMatchObject({ shiftUp: 1 });
    expect(ruleShiftCap(actor, 0, 2)).toBeNull();
    boss.token.document.disposition = 1;
    expect(ruleShiftCap(actor, 0, 4)).toBeNull();
    const zealot = makeActor([makeItem({ name: 'Word of Unicron', type: 'perk' })], { name: 'Zealot', token: tokenAt(200, 0, { disposition: -1 }) });
    onCanvas(actor, boss, zealot);
    expect(ruleShiftCap(actor, 0, 5)).toMatchObject({ shiftUp: 3 });
  });

  test('Agreeable / Base Technological Advancements: readers of PetCommand and PartyRequisition rules', async () => {
    const { rulePetCommandTier } = await import('./plugins/picks/pet-command.mjs');
    const { rulePartyRequisitionPerMember } = await import('./plugins/resources/party-requisition.mjs');
    expect(rulePetCommandTier(makeActor([packItem('agreeable')], { type: 'companion' }))).toBe(-1);
    expect(rulePetCommandTier(makeActor([], { type: 'companion' }))).toBe(0);
    const holder = makeActor([packItem('baseTech')]);
    const other = makeActor([packItem('baseTech')]);
    expect(rulePartyRequisitionPerMember([holder, other, makeActor()])).toBe(1);
    expect(rulePartyRequisitionPerMember([makeActor()])).toBe(0);
  });

  test('Salvaged: a Fumble with the weapon it is fitted to unequips and destroys that weapon', async () => {
    const actor = makeActor([], { name: 'Scav' });
    const rifle = give(actor, makeItem({ name: 'Rifle', type: 'weapon', system: { equipped: true } }));
    const shot = give(actor, makeItem({ name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} }));
    give(actor, packItem('salvaged', { flags: { parentId: rifle.id } }));
    const other = give(actor, makeItem({ name: 'Knife', type: 'weapon', system: { equipped: true } }));
    const stab = give(actor, makeItem({ name: 'Stab', type: 'weaponEffect', flags: { essence20: { parentId: other.id } }, system: {} }));
    await fireTriggers(actor, 'afterRoll', { roll: attackRoll(shot), outcome: 'failure' });
    expect(rifle.system.equipped).toBe(true);
    await fireTriggers(actor, 'afterRoll', { roll: attackRoll(stab), outcome: 'fumble', facts: { isFumble: true } });
    expect(other.system.equipped).toBe(true);
    await fireTriggers(actor, 'afterRoll', { roll: attackRoll(shot), outcome: 'fumble', facts: { isFumble: true } });
    expect(rifle.system.equipped).toBe(false);
    expect(rifle.flags.essence20.destroyed).toBe(true);
  });

  test('Augur: the blade (Silent traded for Armor Piercing) once; Alt Mode Flyby / Ram / Bash attacks gain Armor Piercing and deal Sharp', async () => {
    const { ruleAttackHasTrait } = await import('./plugins/combat/attack-traits.mjs');
    CATALOG.push(entry('Close Combat Blade', 'weapon', 'standard', { traits: ['silent', 'sharp'] }, 'Compendium.essence20.tf_crb.Item.8lNIijY5XompKHH7'));
    const gear = packItem('augur', { source: 'Compendium.essence20.enigma_of_combination.Item.yk2MnBePZ5gxOEOj' });
    const actor = makeActor([gear], { name: 'Bot', system: { isTransformed: true } });
    await use(gear);
    const [blade] = granted(actor, gear);
    expect(blade).toMatchObject({ name: 'Augur Blade', system: expect.objectContaining({ integrated: true, traits: ['sharp', 'armorPiercing'] }) });
    await use(gear);
    expect(granted(actor, gear)).toHaveLength(1);
    const flyby = makeItem({ name: 'Flyby', type: 'weaponEffect', system: { isFlyby: true } });
    const bash = makeItem({ name: 'Shoulder Bash', type: 'weaponEffect', system: {} });
    expect(ruleAttackHasTrait(actor, flyby, 'armorPiercing')).toBe(true);
    expect(ruleAttackHasTrait(actor, bash, 'armorPiercing')).toBe(true);
    expect(ruleAttackHasTrait(actor, flyby, 'antiTank')).toBe(false);
    actor.system.isTransformed = false;
    expect(ruleAttackHasTrait(actor, flyby, 'armorPiercing')).toBe(false);
    CATALOG.pop();
  });

  test('Steady Hand: one more Adept Armament, once; ticked on an Adept attack with a Snag, a Free action drops the Snag', async () => {
    const { applyClearSnagCost } = await import('./plugins/dialog/clear-snag-cost.mjs');
    const { ruleDialogSwitches } = await import('./adapter.mjs');
    const perk = packItem('steadyHand');
    const actor = makeActor([perk], { name: 'Trooper' });
    const rifle = give(actor, makeItem({ name: 'Rifle', type: 'weapon', system: {} }));
    const shot = give(actor, makeItem({ name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} }));
    global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => [rifle.id]), prompt: jest.fn(), confirm: jest.fn() };
    await use(perk);
    expect(rifle.flags.essence20.adeptArmament).toBe(true);
    expect(available(perk)).toBe(false);

    const ctx = attackRoll(shot);
    const [entrySwitch] = ruleDialogSwitches(actor, ctx);
    expect(entrySwitch).toMatchObject({ label: 'Steady Hand: a Free action to roll without the Snag' });
    const options = { snag: true, ext: { [entrySwitch.name]: true } };
    await applyClearSnagCost(actor, options, ctx);
    expect(options.snag).toBe(false);
    const none = { snag: false, ext: { [entrySwitch.name]: true } };
    await applyClearSnagCost(actor, none, ctx);
    expect(none.snag).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Granting entries the drop handlers' way      */
/* -------------------------------------------- */

describe('granting compendium entries the way dropping them does', () => {
  const P = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
  const extra = [
    entry('Fox Instincts', 'perk', null, {}, P('gi_joe_crb', 'FoxInstinctsAAAA')),
    entry('Not A Pet Perk', 'perk', null, {}, P('gi_joe_crb', 'NotAPetPerkAAAAA')),
    entry('Soldier Perk', 'perk', null, { type: 'origin' }, P('gi_joe_crb', 'SoldierPerkAAAAA')),
    entry('Civvy Perk', 'perk', null, { type: 'origin' }, P('gi_joe_crb', 'CivvyPerkAAAAAAA')),
    entry('Ranger General', 'perk', null, { type: 'general' }, P('pr_crb', 'RangerGeneralAAA')),
    entry('Ranger Grit', 'perk', null, { type: 'origin' }, P('pr_crb', 'RangerGritAAAAAA')),
    entry('Soldier', 'origin', null, { items: { a: { uuid: P('gi_joe_crb', 'SoldierPerkAAAAA'), name: 'Soldier Perk', type: 'perk' } } }, P('gi_joe_crb', 'SoldierOriginAAA')),
    entry('Civilian', 'origin', null, { items: { a: { uuid: P('gi_joe_crb', 'CivvyPerkAAAAAAA'), name: 'Civvy Perk', type: 'perk' } } }, P('gi_joe_crb', 'CivilianOriginAA')),
    entry('Ranger Kid', 'origin', null, { items: { a: { uuid: P('pr_crb', 'RangerGeneralAAA'), name: 'Ranger General', type: 'perk' }, b: { uuid: P('pr_crb', 'RangerGritAAAAAA'), name: 'Ranger Grit', type: 'perk' } } }, P('pr_crb', 'RangerKidOrigina')),
    entry('Cybertronian Edge', 'perk', null, { isRoleVariant: true, items: { a: { uuid: P('tf_crb', 'ScoutEdgeAAAAAAA'), name: 'Scout Edge', role: 'Scout' }, b: { uuid: P('tf_crb', 'NoRoleEdgeAAAAAA'), name: 'Plain Edge' } } }, P('tf_crb', 'CybEdgeAAAAAAAAA')),
    entry('Scout Edge', 'perk', null, {}, P('tf_crb', 'ScoutEdgeAAAAAAA')),
  ];
  extra[0].folder = 'pets';
  extra[1].folder = 'other';

  beforeEach(() => {
    CATALOG.push(...extra);
    global.game.packs = new Map([['essence20.gi_joe_crb', { folders: new Map([['pets', { name: 'Pets' }], ['other', { name: 'General Perks' }]]) }]]);
  });

  afterEach(() => {
    CATALOG.splice(CATALOG.length - extra.length, extra.length);
  });

  const ownedPerk = (actor, uuid) => actor.items.contents.find(i => i.flags?.core?.sourceId == uuid);

  test('Animalize: an Animal Perk from a Pets folder, granted the way dropping it does, once', async () => {
    const alteration = packItem('animalize');
    const actor = makeActor([alteration]);
    picks = ['Fox Instincts'];
    await use(alteration);
    expect(offered[0]).toEqual(['Fox Instincts']);
    expect(ownedPerk(actor, P('gi_joe_crb', 'FoxInstinctsAAAA'))).toBeTruthy();
    expect(ownedPerk(actor, P('gi_joe_crb', 'FoxInstinctsAAAA')).flags.essence20.grantedBy).toBeUndefined();
    expect(available(alteration)).toBe(false);
  });

  test('On-The-Job Training / Cybertronian Military / with Attitude: an Origin Benefit of another (G.I. JOE / PR) Origin, once', async () => {
    const otj = packItem('onTheJob');
    const actor = makeActor([otj, makeItem({ name: 'Soldier', type: 'origin' })]);
    picks = ['Civilian: Civvy Perk'];
    await use(otj);
    expect(offered[0]).toEqual(['Civilian: Civvy Perk']);
    expect(ownedPerk(actor, P('gi_joe_crb', 'CivvyPerkAAAAAAA'))).toBeTruthy();
    expect(available(otj)).toBe(false);

    const military = packItem('cybMilitary');
    makeActor([military]);
    picks = ['Soldier: Soldier Perk'];
    await use(military);
    expect(offered[1]).toEqual(['Soldier: Soldier Perk']);

    const attitude = packItem('cybAttitude');
    const bot = makeActor([attitude]);
    picks = ['Ranger Kid: Ranger Grit'];
    await use(attitude);
    expect(offered[2]).toEqual(['Ranger Kid: Ranger Grit']);
    expect(ownedPerk(bot, P('pr_crb', 'RangerGritAAAAAA'))).toBeTruthy();
  });

  test("Cybertronian Perk: a Role's Cybertronian Perk, listed by Role, once", async () => {
    const perk = packItem('cybPerk');
    const actor = makeActor([perk]);
    picks = ['Scout: Scout Edge'];
    await use(perk);
    expect(offered[0]).toEqual(['Scout: Scout Edge']);
    expect(ownedPerk(actor, P('tf_crb', 'ScoutEdgeAAAAAAA'))).toBeTruthy();
  });

  test("Faction Reservist / Field Promotion: a Faction's Perks for the scene - picked, or your own lent to an ally for a Story Point", async () => {
    const reservist = packItem('reservist');
    const actor = makeActor([reservist, makeItem({ name: 'Perk B', type: 'perk', flags: { core: { sourceId: C('fac', 'PerkBBBBBBBBBBBB') } } })]);
    picks = ['Other Faction'];
    await use(reservist);
    expect(granted(actor, reservist).map(i => [i.name, i.flags.essence20.rulesExpiry?.until])).toEqual([['Perk C', 'scene']]);
    expect(available(reservist)).toBe(false);

    const promotion = packItem('fieldPromotion');
    const leader = makeActor([promotion]);
    const ally = makeActor([], { name: 'Ally' });
    target(ally);
    await use(promotion);
    expect(granted(ally, promotion)).toEqual([]);
    give(leader, makeItem({ name: 'Own Faction', type: 'faction', system: { items: { a: { uuid: C('fac', 'PerkAAAAAAAAAAAA'), name: 'Perk A', type: 'perk' } } } }));
    await use(promotion);
    expect(granted(ally, promotion).map(i => i.name)).toEqual(['Perk A']);
  });

  test('Factions: two different factions, each through the Faction drop handler, once', async () => {
    const perk = packItem('factionsEnvoy');
    const actor = makeActor([perk]);
    picks = ['Own Faction', 'Other Faction'];
    await use(perk);
    expect(offered[1]).toEqual(['Other Faction']);
    expect(granted(actor, perk).map(i => i.name)).toEqual(['Own Faction', 'Other Faction']);
    expect(factionDrops).toEqual(['Own Faction', 'Other Faction']);
    expect(available(perk)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Sprinting, shoving, slowing                  */
/* -------------------------------------------- */

describe('sprinting, shoving and slowing', () => {
  test('Muzzle Punch: a Move action, the better of Finesse / Might vs Toughness at a creature within reach; 5 ft push and slow (10 on a double)', async () => {
    const { pushActor, slowNextTurn } = await import('../mechanics/combat/forced-movement.mjs');
    const perk = packItem('muzzlePunch');
    const actor = makeActor([perk], { name: 'Gunner', token: tokenAt(0, 0), system: { skills: { finesse: { shift: 'd20' }, might: { shift: 'd6' } } } });
    const foe = makeActor([], { name: 'Foe', token: tokenAt(100, 0) });
    target(foe);
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    const rifle = give(actor, makeItem({ name: 'Rifle', type: 'weapon', system: { equipped: true, derivedHands: 2 } }));
    give(actor, makeItem({ name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: { classification: { style: 'projectile' } } }));
    await use(perk);
    expect(pay).toHaveBeenCalledWith('move');
    expect(vsMany).toEqual([{ skill: 'might', defense: 'toughness', targets: ['Foe'] }]);
    expect(pushActor).toHaveBeenLastCalledWith(foe, actor, 5);
    expect(slowNextTurn).toHaveBeenLastCalledWith(foe, 5);
    vsMultipliers = [2];
    actor.system.skills.finesse.shift = 'd8';
    await use(perk);
    expect(vsMany.at(-1).skill).toBe('finesse');
    expect(pushActor).toHaveBeenLastCalledWith(foe, actor, 10);
    expect(slowNextTurn).toHaveBeenLastCalledWith(foe, 10);
    foe.token.center.x = 1000;
    pay.mockClear();
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
  });

  test('Wrecking Ball: a Story Point and a Standard action start the sprint (Rough Terrain ignored); then Might with an Edge at those moved through - 2 Blunt and Prone', async () => {
    const { ruleMovement } = await import('./adapter.mjs');
    const perk = packItem('wreckingBall');
    const actor = makeActor([perk], { name: 'Juggernaut' });
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [{ actor }], getCombatantsByActor: () => [] };
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(economy.setSprinting).toHaveBeenCalledWith(actor, true);
    expect(ruleMovement(actor).ignoreRoughTerrain).toBe(true);
    const foe = makeActor([], { name: 'Foe', token: tokenAt(0, 0) });
    target(foe);
    pay.mockClear();
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    expect(vsMany.at(-1)).toEqual({ skill: 'might', defense: 'toughness', targets: ['Foe'] });
    expect(vsExtras.at(-1)).toMatchObject({ edge: true });
    expect(dealt).toEqual([{ name: 'Foe', amount: 2, type: 'blunt' }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'prone', rounds: 0 }]);
    global.game.combat.turn = 1;
    expect(ruleMovement(actor).ignoreRoughTerrain).toBe(false);
  });

  test('Bowl-Over: in a combat, while Sprinting, a Free action shoves with push and Prone both', async () => {
    const perk = packItem('bowlOver');
    const actor = makeActor([perk], { name: 'Ranger', token: tokenAt(0, 0) });
    expect(available(perk)).toBe(false);
    let sprinting = false;
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [], getCombatantsByActor: () => [{ getFlag: () => ({ sprinting }) }] };
    expect(available(perk)).toBe(true);
    await use(perk);
    expect(pay).not.toHaveBeenCalled();
    sprinting = true;
    const foe = makeActor([], { name: 'Foe', token: tokenAt(10, 0) });
    target(foe);
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    expect(riders.rollShove).toHaveBeenCalledWith(actor, { bowlOver: true });
  });
});

/* -------------------------------------------- */
/*  Armor Upgrades, Maneuvers and disarms        */
/* -------------------------------------------- */

describe('armor upgrades, maneuvers and disarms', () => {
  const armored = (name, bonuses) => {
    const actor = makeActor([], { name });
    const armor = give(actor, makeItem({ name: 'Armor', type: 'armor', system: { equipped: true } }));
    for (const [defense, value] of bonuses) {
      give(actor, makeItem({ name: 'Plate', type: 'upgrade', flags: { essence20: { parentId: armor.id } }, system: { type: 'armor', armorBonus: { defense, value } } }));
    }

    return actor;
  };

  const weaponAttack = (actor, style, extra = {}) => {
    const weapon = give(actor, makeItem({ name: 'Weapon', type: 'weapon', system: { equipped: true, ...(extra.weapon ?? {}) } }));
    return give(actor, makeItem({ name: 'Attack', type: 'weaponEffect', flags: { essence20: { parentId: weapon.id } }, system: { classification: { style }, ...(extra.attack ?? {}) } }));
  };

  test("Pinpoint: on an Aimed ranged attack (any out of combat), ignore up to 3 of the target's Armor Upgrades, biggest first", async () => {
    const { ruleDialogSwitches } = await import('./adapter.mjs');
    const { armorUpgradeAdjust } = await import('./plugins/combat/armor-upgrades.mjs');
    const actor = makeActor([packItem('pinpoint')], { name: 'Sniper' });
    const shot = weaponAttack(actor, 'projectile');
    const foe = armored('Foe', [['toughness', 1], ['toughness', 3], ['toughness', 2], ['evasion', 4]]);
    const [entrySwitch] = ruleDialogSwitches(actor, { item: shot, isAttack: true });
    expect(entrySwitch).toMatchObject({ type: 'number', max: 3 });
    expect(armorUpgradeAdjust(actor, foe, 'toughness', { isAttack: true, ext: { [entrySwitch.name]: 2 } })).toBe(-5);
    expect(armorUpgradeAdjust(actor, foe, 'toughness', { isAttack: true, ext: { [entrySwitch.name]: 3 } })).toBe(-6);
    expect(armorUpgradeAdjust(actor, foe, 'evasion', { isAttack: true, ext: { [entrySwitch.name]: 1 } })).toBe(-4);
    expect(armorUpgradeAdjust(actor, foe, 'toughness', { isAttack: true, ext: {} })).toBe(0);
    expect(armorUpgradeAdjust(actor, foe, 'toughness', { isAttack: false, ext: { [entrySwitch.name]: 2 } })).toBe(0);
    const stab = weaponAttack(actor, 'melee');
    expect(ruleDialogSwitches(actor, { item: stab, isAttack: true })).toEqual([]);
    // In combat only once the Aim action is taken.
    global.game.combat = { id: 'c1', round: 1, turn: 0, started: true, turns: [], combatants: [] };
    expect(ruleDialogSwitches(actor, { item: shot, isAttack: true, aimed: false })).toEqual([]);
    expect(ruleDialogSwitches(actor, { item: shot, isAttack: true, aimed: true })).toHaveLength(1);
  });

  test('Make an Opening: an unarmed attack at ↓2 at an armored target; a hit lowers its Armor Upgrades by 2 (Toughness first) for the scene', async () => {
    const { ruleDialogSwitches } = await import('./adapter.mjs');
    const { armorUpgradeAdjust } = await import('./plugins/combat/armor-upgrades.mjs');
    const actor = makeActor([packItem('makeAnOpening')], { name: 'Brawler' });
    const punch = give(actor, makeItem({ name: 'Punch', type: 'weaponEffect', system: { classification: { style: 'melee' } } }));
    const foe = armored('Foe', [['toughness', 1], ['evasion', 3]]);
    const bare = makeActor([], { name: 'Bare' });
    target(bare);
    expect(ruleDialogSwitches(actor, { item: punch, isAttack: true, isMelee: true })).toEqual([]);
    target(foe);
    const switches = ruleDialogSwitches(actor, { item: punch, isAttack: true, isMelee: true });
    expect(switches).toHaveLength(1);
    await fireTriggers(actor, 'hit', { roll: { item: punch, isAttack: true, switches: [] }, outcome: 'success', targets: [foe] });
    expect(foe.flags.essence20.ruleMarks?.armorStrip).toBeUndefined();
    await fireTriggers(actor, 'hit', { roll: { item: punch, isAttack: true, switches: ['makeAnOpening'] }, outcome: 'success', targets: [foe] });
    expect(foe.flags.essence20.ruleMarks.armorStrip).toMatchObject({ by: actor.uuid, until: 'scene' });
    // Only 1 Toughness to take (never below +0); Evasion untouched since it has a Toughness upgrade.
    expect(armorUpgradeAdjust(null, foe, 'toughness', {})).toBe(-1);
    expect(armorUpgradeAdjust(null, foe, 'evasion', {})).toBe(0);
    const evasive = armored('Dodger', [['evasion', 3]]);
    await fireTriggers(actor, 'hit', { roll: { item: punch, isAttack: true, switches: ['makeAnOpening'] }, outcome: 'success', targets: [evasive] });
    expect(armorUpgradeAdjust(null, evasive, 'evasion', {})).toBe(-2);
  });

  test('Snatch: Maneuvers can disarm (ManeuverOption); ↓1 at a target wielding a two-handed weapon', async () => {
    const { ruleManeuverOption } = await import('./plugins/combat/maneuver-option.mjs');
    const perk = packItem('snatch');
    const actor = makeActor([perk], { name: 'Thief' });
    expect(ruleManeuverOption(actor, 'disarm')).toBe(perk);
    expect(ruleManeuverOption(makeActor(), 'disarm')).toBeNull();
    const grab = give(actor, makeItem({ name: 'Grab', type: 'weaponEffect', system: { damageType: 'maneuver', classification: { style: 'melee' } } }));
    const twoHanded = makeActor([], { name: 'Big' });
    weaponAttack(twoHanded, 'melee', { weapon: { derivedHands: 2 } });
    const oneHanded = makeActor([], { name: 'Small' });
    weaponAttack(oneHanded, 'melee', { weapon: { derivedHands: 1 } });
    const sources = (other, item = grab) => ruleRollSources(actor, other, { item, isAttack: true }).sources.map(s => [s.label, s.shiftDown]);
    expect(sources(twoHanded)).toEqual([['Snatch (a two-handed weapon)', 1]]);
    expect(sources(oneHanded)).toEqual([]);
    const jab = give(actor, makeItem({ name: 'Jab', type: 'weaponEffect', system: { damageType: 'blunt', classification: { style: 'melee' } } }));
    expect(sources(twoHanded, jab)).toEqual([]);
  });

  test('Disarming Shot (Decepticon Directive): a damaging ranged hit offers the disarm (optional, Free actions paid as used)', async () => {
    const actor = makeActor([packItem('disarmingShotDD')], { name: 'Scav' });
    const shot = weaponAttack(actor, 'projectile');
    const stab = weaponAttack(actor, 'melee');
    const foe = makeActor([], { name: 'Foe' });
    riders.disarm.mockClear();
    await fireTriggers(actor, 'hit', { roll: { item: shot, isAttack: true }, outcome: 'success', targets: [foe], facts: { results: [{ damageValue: 0 }] } });
    await fireTriggers(actor, 'hit', { roll: { item: stab, isAttack: true, isMelee: true }, outcome: 'success', targets: [foe], facts: { results: [{ damageValue: 2 }] } });
    expect(riders.disarm).not.toHaveBeenCalled();
    await fireTriggers(actor, 'hit', { roll: { item: shot, isAttack: true }, outcome: 'success', targets: [foe], facts: { results: [{ damageValue: 2 }] } });
    expect(riders.disarm).toHaveBeenCalledWith(actor, foe, expect.objectContaining({ maxHands: 2, optional: true, payFree: true }));
  });

  test("Scapegoat's Hang-Up: a roll that still succeeds after the Scapegoat swap deals 1 Smarts damage", async () => {
    const victim = makeActor([packItem('scapegoat')], { name: 'Patsy', system: { essences: { smarts: { max: 3, value: 3 } } } });
    const foe = makeActor([], { name: 'Foe' });
    await fireTriggers(victim, 'targeted', { roll: { isAttack: true, entry: { scapegoatSwapped: false } }, outcome: 'success', targets: [foe] });
    await fireTriggers(victim, 'targeted', { roll: { isAttack: true }, outcome: 'success', targets: [foe] });
    await fireTriggers(victim, 'targeted', { roll: { isAttack: true, entry: { scapegoatSwapped: true } }, outcome: 'failure', targets: [foe] });
    expect(victim.update).not.toHaveBeenCalled();
    await fireTriggers(victim, 'targeted', { roll: { isAttack: true, entry: { scapegoatSwapped: true } }, outcome: 'success', targets: [foe] });
    expect(victim.update).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Areas and Condition durations                */
/* -------------------------------------------- */

describe('areas and Condition durations', () => {
  let nextRoll = 3;
  const formulas = [];
  beforeEach(() => {
    nextRoll = 3;
    formulas.length = 0;
    global.Roll = class {
      constructor(formula) {
        this.formula = formula;
        formulas.push(formula);
      }

      async evaluate() {
        this.total = nextRoll;
        return this;
      }
    };
    global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => null), prompt: jest.fn(), confirm: jest.fn() };
    global.canvas.tokens.setTargets = jest.fn();
  });
  const wait = () => global.foundry.applications.api.DialogV2.wait;

  const effectOf = (actor, system, weapon = null) => {
    const parent = weapon ? give(actor, makeItem({ name: 'Launcher', type: 'weapon', system: { equipped: true, ...weapon } })) : null;
    return give(actor, makeItem({ name: 'Blast', type: 'weaponEffect', flags: { essence20: parent ? { parentId: parent.id } : {} }, system }));
  };

  test('Gyro-Gun Alternate Effect: its Impaired lasts 1d2 rounds (ConditionDuration), any other Impaired attack 1', async () => {
    const { ruleConditionRounds } = await import('./plugins/combat/condition-duration.mjs');
    const gyro = packItem('gyroGun');
    nextRoll = 2;
    expect(await ruleConditionRounds(gyro, 'impaired', 1)).toBe(2);
    expect(formulas).toEqual(['1d2']);
    expect(await ruleConditionRounds(gyro, 'stunned', 1)).toBe(1);
    expect(await ruleConditionRounds(makeItem({ type: 'weaponEffect', system: { damageType: 'impaired' } }), 'impaired', 1)).toBe(1);
    expect(await ruleConditionRounds(makeItem({ system: { rules: [{ type: 'ConditionDuration', condition: 'impaired', rounds: '3' }] } }), 'impaired', 1)).toBe(3);
  });

  test('Shaped Charges: an explosive attack rolls its Skill die and the attacker unticks up to that many caught targets; double damage to objects', async () => {
    const { ruleAreaExclusions } = await import('./plugins/combat/before-area.mjs');
    const { hitMultiplierOnAttack } = await import('./plugins/zords/megaform-finisher.mjs');
    const actor = makeActor([packItem('shapedCharges')], { name: 'Artillery', system: { skills: { targeting: { shift: 'd8' } } } });
    const grenade = effectOf(actor, { classification: { skill: 'targeting', style: 'explosive' }, shape: 'circle', radius: 10 });
    const rifle = effectOf(actor, { classification: { skill: 'targeting', style: 'projectile' }, shape: 'circle', radius: 10 });
    const tokens = [{ id: 't1', name: 'Alpha' }, { id: 't2', name: 'Bravo' }, { id: 't3', name: 'Charlie' }];
    expect(await ruleAreaExclusions(actor, rifle, tokens)).toBe(tokens);
    expect(await ruleAreaExclusions(actor, grenade, [])).toEqual([]);
    expect(wait()).not.toHaveBeenCalled();
    wait().mockImplementation(async ({ buttons }) => buttons.find(b => b.action == 'confirm').callback(null, { form: { elements: { t1: { checked: true } } } }));
    nextRoll = 5;
    expect(await ruleAreaExclusions(actor, grenade, tokens)).toEqual([tokens[1], tokens[2]]);
    expect(formulas).toEqual(['d8']);
    expect(global.canvas.tokens.setTargets).toHaveBeenCalledWith(['t2', 't3']);
    const call = wait().mock.calls[0][0];
    expect(call.content).toContain('Alpha');
    expect(call.content).toContain('E20.ShapedChargesPickLabel{"count":5}');
    expect(call.window.title).toBe('E20.ShapedChargesPickTitle');
    // Cancelled / nothing ticked: all stay.
    wait().mockImplementation(async ({ buttons }) => buttons.find(b => b.action == 'cancel').callback());
    expect(await ruleAreaExclusions(actor, grenade, tokens)).toEqual(tokens);
    // Not a die (autoSuccess): no prompt.
    actor.system.skills.targeting.shift = 'autoSuccess';
    wait().mockClear();
    expect(await ruleAreaExclusions(actor, grenade, tokens)).toBe(tokens);
    expect(wait()).not.toHaveBeenCalled();
    expect(await ruleAreaExclusions(makeActor(), grenade, tokens)).toBe(tokens);

    // Book check (effects): "double damage" doubles the whole row, the flat hit bonuses on it included - a stage "late"
    // HitMultiplier (the row's 3 here stands for 2 damage + a +1 rider), not the early one that left those out.
    const notes = [];
    hitMultiplierOnAttack(actor, makeActor([], { name: 'Wall', system: { creatureTags: 'wall' } }), { damageValue: 3 }, { itemUuid: grenade.uuid, style: 'explosive' }, { damageBonusNote: (r, amount, label) => notes.push([amount, label]) });
    expect(notes).toEqual([]);
    const { applyLateHitMultipliers } = await import('./plugins/combat/card-hit-multiplier.mjs');
    const row = async (victim, item) => {
      const results = [{ damageValue: 3, targetUuid: victim.uuid }];
      await applyLateHitMultipliers(actor, results, { riderContext: { itemUuid: item.uuid, style: item.system.classification.style } });
      return results[0].damageValue;
    };

    expect(await row(makeActor([], { name: 'Wall', system: { creatureTags: 'wall' } }), grenade)).toBe(6);
    expect(await row(makeActor([], { name: 'Bunker', system: { creatureTags: 'structure' } }), grenade)).toBe(6);
    expect(await row(makeActor([], { name: 'Wall', system: { creatureTags: 'wall' } }), rifle)).toBe(3);
    expect(await row(makeActor([], { name: 'Soldier' }), grenade)).toBe(3);
  });

  test('Concentrated Explosion: an explosive area 5 ft bigger / smaller (above 5 ft) or another shape, asked before it is placed', async () => {
    const { ruleBeforeArea } = await import('./plugins/combat/before-area.mjs');
    const actor = makeActor([packItem('concentratedExplosion')], { name: 'Saboteur' });
    const grenade = effectOf(actor, { classification: { style: 'explosive' }, shape: 'circle', radius: 10 });
    const small = effectOf(actor, { classification: { style: 'explosive' }, shape: 'cone', radius: 5 });
    const rifle = effectOf(actor, { classification: { style: 'projectile' }, shape: 'circle', radius: 10 });
    const lone = effectOf(actor, { classification: { style: 'explosive' }, radius: 0 });
    expect(await ruleBeforeArea(actor, rifle)).toBeNull();
    expect(await ruleBeforeArea(actor, lone)).toBeNull();
    expect(await ruleBeforeArea(makeActor(), grenade)).toBeNull();
    expect(wait()).not.toHaveBeenCalled();
    wait().mockResolvedValueOnce('bigger');
    expect(await ruleBeforeArea(actor, grenade)).toEqual({ radiusDeltaFeet: 5, shape: null, single: false, dataset: {} });
    expect(wait().mock.calls[0][0].buttons.map(b => b.action)).toEqual(['normal', 'bigger', 'smaller', 'shape-cone', 'shape-line']);
    expect(wait().mock.calls[0][0].window.title).toBe('Concentrated Explosion');
    wait().mockResolvedValueOnce('shape-circle');
    expect(await ruleBeforeArea(actor, small)).toEqual({ radiusDeltaFeet: 0, shape: 'circle', single: false, dataset: {} });
    expect(wait().mock.calls[1][0].buttons.map(b => b.action)).toEqual(['normal', 'bigger', 'shape-circle', 'shape-line']);
    wait().mockResolvedValueOnce(null);
    expect(await ruleBeforeArea(actor, grenade)).toBeNull();
  });

  test('Concentrated Fire: a fire area or Multiple Targets attack may hit one creature instead (the roll gets concentratedFire)', async () => {
    const { ruleBeforeArea } = await import('./plugins/combat/before-area.mjs');
    const actor = makeActor([packItem('concentratedFire')], { name: 'Pyro' });
    const flamer = effectOf(actor, { classification: { style: 'projectile' }, shape: 'cone', radius: 15 }, { traits: ['fire'] });
    const burst = effectOf(actor, { classification: { style: 'projectile' }, numTargets: 3, damageType: 'fire' });
    const single = effectOf(actor, { classification: { style: 'projectile' }, damageType: 'fire' });
    const cold = effectOf(actor, { classification: { style: 'projectile' }, shape: 'cone', radius: 15 }, { traits: ['cold'] });
    expect(await ruleBeforeArea(actor, single)).toBeNull();
    expect(await ruleBeforeArea(actor, cold)).toBeNull();
    wait().mockResolvedValueOnce('single');
    expect(await ruleBeforeArea(actor, flamer)).toEqual({ radiusDeltaFeet: 0, shape: null, single: true, dataset: { concentratedFire: true } });
    expect(wait().mock.calls[0][0].buttons.map(b => b.action)).toEqual(['normal', 'single']);
    wait().mockResolvedValueOnce('normal');
    expect(await ruleBeforeArea(actor, burst)).toEqual({ radiusDeltaFeet: 0, shape: null, single: false, dataset: {} });
    // Both Perks: one dialog, titled for the area change.
    give(actor, packItem('concentratedExplosion'));
    const fireGrenade = effectOf(actor, { classification: { style: 'explosive' }, shape: 'circle', radius: 10, damageType: 'fire' });
    wait().mockResolvedValueOnce('normal');
    await ruleBeforeArea(actor, fireGrenade);
    expect(wait().mock.calls[2][0].buttons.map(b => b.action)).toEqual(['normal', 'bigger', 'smaller', 'shape-cone', 'shape-line', 'single']);
    expect(wait().mock.calls[2][0].window.title).toBe('Concentrated Explosion');
  });
});

/* -------------------------------------------- */
/*  Shrugging, dismantling, poisons              */
/* -------------------------------------------- */

describe('shrugging extras, dismantling guns, swapping poisons', () => {
  test('Unstoppable Force: in heavy armor, Toughness used against an Evasion attack drops the extras (SwapShrug)', async () => {
    const { ruleSwapShrug } = await import('./plugins/combat/swap-shrug.mjs');
    const perk = packItem('unstoppableForce');
    const juggernaut = makeActor([perk], { name: 'Juggernaut' });
    const armor = give(juggernaut, makeItem({ name: 'Plate', type: 'armor', system: { equipped: true, classification: 'heavy' } }));
    expect(ruleSwapShrug(juggernaut, 'toughness', 'evasion')).toBe(perk);
    expect(ruleSwapShrug(juggernaut, 'toughness', 'toughness')).toBeNull();
    expect(ruleSwapShrug(juggernaut, 'evasion', 'toughness')).toBeNull();
    expect(ruleSwapShrug(juggernaut, 'toughness', undefined)).toBeNull();
    armor.system.classification = 'medium';
    expect(ruleSwapShrug(juggernaut, 'toughness', 'evasion')).toBeNull();
    armor.system.classification = 'ultraHeavy';
    expect(ruleSwapShrug(juggernaut, 'toughness', 'evasion')).toBe(perk);
    armor.system.equipped = false;
    expect(ruleSwapShrug(juggernaut, 'toughness', 'evasion')).toBeNull();
    expect(ruleSwapShrug(makeActor(), 'toughness', 'evasion')).toBeNull();
  });

  test('Dismantle Firearm: a disarmed gun (Ballistic or Reload) may be pulled apart (ManeuverOption dismantle)', async () => {
    const { ruleManeuverOption } = await import('./plugins/combat/maneuver-option.mjs');
    const perk = packItem('dismantleFirearm');
    const actor = makeActor([perk], { name: 'Commando' });
    const gun = makeItem({ name: 'Rifle', type: 'weapon', system: { traits: ['ballistic'] } });
    const revolver = makeItem({ name: 'Revolver', type: 'weapon', system: { traits: ['reload'] } });
    const sword = makeItem({ name: 'Sword', type: 'weapon', system: { traits: ['sharp'] } });
    expect(ruleManeuverOption(actor, 'dismantle', gun)).toBe(perk);
    expect(ruleManeuverOption(actor, 'dismantle', revolver)).toBe(perk);
    expect(ruleManeuverOption(actor, 'dismantle', sword)).toBeNull();
    expect(ruleManeuverOption(actor, 'disarm')).toBeNull();
    expect(ruleManeuverOption(makeActor(), 'dismantle', gun)).toBeNull();
  });

  test('Poison Prodigy: a held poison traded for another from the compendiums (Standard action, an unlinked copy), or a Move action for an upgrade', async () => {
    const venom = entry('Venom', 'weapon', 'standard', { isPoison: true, quantity: 4 }, 'Compendium.essence20.cobra_codex.Item.VenomAAAAAAAAAAA');
    CATALOG.push(venom);
    const perk = packItem('poisonProdigy');
    const actor = makeActor([perk], { name: 'Viper' });
    const old = give(actor, makeItem({ name: 'Old Poison', type: 'weapon', system: { isPoison: true, quantity: 2 } }));
    give(actor, makeItem({ name: 'Knife', type: 'weapon', system: {} }));
    economy.spend.mockClear();
    // An upgrade: only the Move action.
    chooses = ['Add an upgrade (Move action)'];
    await use(perk);
    expect(economy.spend).toHaveBeenCalledWith(actor, 'move', expect.anything());
    economy.spend.mockClear();
    // A new type: the old vial, then the new poison.
    chooses = ["Change a poison's type (Standard action)"];
    picks = ['Old Poison', 'Venom'];
    await use(perk);
    expect(offered[0]).toEqual(['Old Poison']);
    expect(offered[1]).toEqual(['Venom']);
    expect(economy.spend).toHaveBeenCalledWith(actor, 'standard', expect.anything());
    const made = actor.items.contents.find(item => item.name == 'Venom');
    expect(made.system.quantity).toBe(1);
    expect(made.flags.essence20.grantedBy).toBeUndefined();
    expect(old.system.quantity).toBe(1);
    // The last vial goes.
    chooses = ["Change a poison's type (Standard action)"];
    picks = ['Old Poison', 'Venom'];
    await use(perk);
    expect(actor.items.contents.some(item => item.name == 'Old Poison')).toBe(false);
    CATALOG.pop();
  });
});

/* -------------------------------------------- */
/*  Tech picks and copied abilities              */
/* -------------------------------------------- */

describe('Technician tech and copied abilities', () => {
  const TECH = [
    entry('Heavy Plate', 'armor', 'limited', { classification: 'heavy' }),
    entry('Super Plate', 'armor', 'restricted', { classification: 'ultraHeavy' }),
    entry('Std Padding', 'upgrade', 'standard', { type: 'armor' }),
    entry('Drone Mod', 'upgrade', 'standard', { type: 'drone' }),
    entry('HTB Access Pad', 'gear', null, {}, 'Compendium.essence20.gi_joe_crb.Item.KiDQM6Sgsm1jsjcS'),
  ];
  let labels = [];
  const askLabels = async (step, options) => {
    labels.push(options.map(option => option.label));
    const want = chooses.shift();
    const at = options.findIndex(option => option.label == want);
    return at < 0 ? null : at;
  };

  beforeEach(() => {
    CATALOG.push(...TECH);
    labels = [];
  });
  afterEach(() => {
    CATALOG.splice(CATALOG.length - TECH.length, TECH.length);
  });

  test('Primary Tech: armor - heavy armor training, light to heavy armor, a Standard armor upgrade and an Integrated Standard sidearm; once', async () => {
    const perk = packItem('primaryTech', { source: 'Compendium.essence20.gi_joe_crb.Item.5eOqntPaqp1g4M7k' });
    const actor = makeActor([perk], { name: 'Tech' });
    chooses = ['Armor'];
    picks = ['Heavy Plate', 'Std Padding', 'Hand Laser'];
    await runUse(perk, pay, { ask: askLabels });
    expect(labels[0]).toEqual(['Armor', 'Drone', 'Gear', 'Weapon']);
    expect(actor.system.trained.armors.heavy).toBe(true);
    expect(offered[0]).toEqual(['Heavy Plate']);
    expect(granted(actor, perk).map(item => item.name)).toEqual(['Heavy Plate', 'Std Padding', 'Hand Laser']);
    expect(granted(actor, perk)[2].system.integrated).toBe(true);
    expect(perk.flags.essence20).toMatchObject({ techChoice: 'armor', granted: true });
    expect(available(perk)).toBe(false);
  });

  test('Primary Tech: a cancelled optional pick skips only that grant; gear - the Access Pad, a kit and an upgrade', async () => {
    const perk = packItem('primaryTech');
    const actor = makeActor([perk], { name: 'Tech' });
    chooses = ['Gear'];
    picks = ['Limited Burglary Kit'];
    await runUse(perk, pay, { ask: askLabels });
    expect(granted(actor, perk).map(item => item.name)).toEqual(['HTB Access Pad', 'Limited Burglary Kit']);
    expect(perk.flags.essence20.granted).toBe(true);
  });

  test('Primary Tech: a drone - a linked Limited drone companion with a Standard drone upgrade', async () => {
    const { createViaGm } = await import('../mechanics/world/gm-relay.mjs');
    createViaGm.mockImplementation(async (kind, { data }) => makeActor([], { name: data.name, type: data.type, system: data.system, flags: data.flags?.essence20 ?? {} }).uuid);
    global.game.i18n.localize = key => (key == 'E20.TechDroneName' ? "{name}'s Drone" : key);
    global.foundry.utils.mergeObject = (a, b) => ({ ...a, ...b, flags: { ...(a.flags ?? {}), ...(b.flags ?? {}) } });
    const perk = packItem('primaryTech');
    const actor = makeActor([perk], { name: 'Tech' });
    chooses = ['Drone'];
    picks = ['Drone Mod'];
    await runUse(perk, pay, { ask: askLabels });
    const drone = global.game.actors.find(other => other.name == "Tech's Drone");
    expect(drone.system).toMatchObject({ type: 'drone', availability: 'limited' });
    expect(drone.flags.essence20.companionOf).toBe(actor.uuid);
    expect(drone.items.contents.map(item => item.name)).toEqual(['Drone Mod']);
    createViaGm.mockReset();
  });

  test("Secondary Tech: another of the four (not the Primary Tech's), or the Primary Tech enhanced", async () => {
    const primary = packItem('primaryTech', { source: 'Compendium.essence20.gi_joe_crb.Item.5eOqntPaqp1g4M7k', flags: { techChoice: 'armor', granted: true } });
    const perk = packItem('secondaryTech');
    const actor = makeActor([primary, perk], { name: 'Tech' });
    chooses = ['Enhance your Primary Tech (Armor)'];
    picks = ['Super Plate', 'Std Padding', 'Std Padding', 'Hand Laser'];
    await runUse(perk, pay, { ask: askLabels });
    expect(labels[0]).toEqual(['Drone', 'Gear', 'Weapon', 'Enhance your Primary Tech (Armor)']);
    expect(actor.system.trained.armors.ultraHeavy).toBe(true);
    expect(granted(actor, perk).map(item => item.name)).toEqual(['Super Plate', 'Std Padding', 'Std Padding', 'Hand Laser']);
    expect(perk.flags.essence20.techChoice).toBe('enhance');
    // With no Primary Tech choice yet: the four, no enhancing.
    const fresh = packItem('secondaryTech');
    makeActor([fresh], { name: 'New' });
    chooses = [];
    labels = [];
    await runUse(fresh, pay, { ask: askLabels });
    expect(labels[0]).toEqual(['Armor', 'Drone', 'Gear', 'Weapon']);
  });

  test("I Can Do That / I Can Still Do That: a Personal Power for a teammate's General Perk or Grid Power until the end of the next turn, kept for the scene", async () => {
    const copier = packItem('iCanDoThat');
    const again = packItem('iCanStillDoThat');
    const actor = makeActor([copier, again], { name: 'Orange', token: tokenAt(0, 0), system: { powers: { personal: { value: 2, max: 3 } } } });
    const ally = makeActor([
      makeItem({ name: 'Perk A', type: 'perk', system: { type: 'general' }, flags: { core: { sourceId: C('fac', 'PerkAAAAAAAAAAAA') } } }),
      makeItem({ name: 'Role Perk', type: 'perk', system: { type: 'role' }, flags: { core: { sourceId: C('fac', 'RolePerkAAAAAAAA') } } }),
      makeItem({ name: 'Perk B', type: 'power', system: { type: 'grid' }, flags: { core: { sourceId: C('fac', 'PerkBBBBBBBBBBBB') } } }),
    ], { name: 'Ally', token: tokenAt(100, 0) });
    onCanvas(actor, ally);
    picks = ['Ally: Perk A'];
    await use(copier);
    expect(offered[0]).toEqual(['Ally: Perk A', 'Ally: Perk B']);
    expect(actor.system.powers.personal.value).toBe(1);
    const [copy] = granted(actor, copier);
    expect(copy.name).toBe('Perk A');
    expect(copy.flags.essence20.rulesExpiry).toMatchObject({ until: 'endOfNextTurnOrScene' });
    expect(actor.flags.essence20.copiedAbilities).toEqual({ scene: 1, list: [{ value: C('fac', 'PerkAAAAAAAAAAAA'), label: 'Ally: Perk A' }] });
    // A cancelled pick costs nothing.
    picks = [];
    await use(copier);
    expect(actor.system.powers.personal.value).toBe(1);
    // Again, from this scene's list.
    picks = ['Ally: Perk A'];
    await use(again);
    expect(offered.at(-1)).toEqual(['Ally: Perk A']);
    expect(actor.system.powers.personal.value).toBe(0);
    expect(granted(actor, again).map(item => item.name)).toEqual(['Perk A']);
    // A new scene: nothing kept.
    actor.flags.essence20.copiedAbilities.scene = 0;
    actor.system.powers.personal.value = 1;
    offered = [];
    picks = ['Ally: Perk A'];
    await use(again);
    expect(granted(actor, again)).toHaveLength(1);
  });
});
