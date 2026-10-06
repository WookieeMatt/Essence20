import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 15, part "items1" (docs/rules-batches/slItems115.md): the survey's "piece" items under module/items/ (attacks ...
 * healing), moved onto the items' own rules with the engine pieces built for them. Each item is loaded from its pack source
 * and must do what the removed code (and its old tests) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };

let picks = [];
let offered = [];
let rolls = [];
const rollsMade = [];
const CATALOG = [];
const grants = {
  findItems: jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
    && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry)))),
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
  grantCopy: jest.fn(async (actor, uuid, { grantedBy } = {}) => {
    const entry = CATALOG.find(e => e.uuid == uuid);
    const [made] = await actor.createEmbeddedDocuments('Item', [{
      name: entry.name, type: entry.type, system: JSON.parse(JSON.stringify(entry.system)),
      flags: { core: { sourceId: uuid }, essence20: { grantedBy: grantedBy?.id } },
    }]);
    return made;
  }),
  rollTest: jest.fn(async (actor, skill, dif) => {
    rollsMade.push({ skill, dif });
    return rolls.shift() ?? { success: true, crit: false };
  }),
  markIntegrated: jest.fn(data => data),
};
const conditions = [];
const dealt = [];
const vsMany = [];
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => grants);
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/timed-status.mjs', () => ({
  applyTimedCondition: jest.fn(async (actor, status, rounds) => conditions.push({ name: actor.name, status, rounds })),
}));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({
  applyDamage: jest.fn(async (actor, amount, type) => dealt.push({ name: actor.name, amount, type })),
}));
jest.unstable_mockModule('./mechanics/combat/reaction-engine.mjs', () => ({
  lastApplyContext: () => null,
  rollVsMany: jest.fn(async (actor, skill, others, defense) => {
    vsMany.push({ skill, defense, targets: others.map(other => other.name) });
    return others.map(other => ({ targetUuid: other.uuid, success: other.name != 'Lucky' }));
  }),
  rollVs: jest.fn(async () => ({ success: true })),
}));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({ createItemCopies: jest.fn(async () => {}), setEntryAndAddItem: jest.fn(async () => 'k1') }));
const temp = [];
jest.unstable_mockModule('./mechanics/resources/temporary-resources.mjs', () => ({
  grantTemp: jest.fn(async (actor, grant) => temp.push({ name: actor.name, ...grant })),
}));
const granted = [];
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({
  grantActionsThisTurn: jest.fn(async (actor, grants) => granted.push({ name: actor.name, grants })),
  spend: jest.fn(async () => ({})),
  getLedger: () => null,
  setNextTurn: jest.fn(),
}));

// The tokens a shape catches (mechanics/combat/aoe-targeting.mjs#getTokensInShape), set per test.
let caught = [];
const shapes = [];
jest.unstable_mockModule('./mechanics/combat/aoe-targeting.mjs', () => ({
  feetToPixels: feet => feet * 10,
  getTokensInShape: jest.fn(shape => {
    shapes.push(shape);
    return caught;
  }),
}));

// The ally tokens around a creature (mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens), set per test.
let allyTokens = [];
jest.unstable_mockModule('./mechanics/combat/nearby-allies.mjs', () => ({
  // Tokens on a line: allyTokens[i].at is the position in feet; no position counts as 0.
  getNearbyAllyTokens: jest.fn((actor, feet = Infinity) => {
    const at = one => allyTokens.find(token => token.actor === one)?.at ?? 0;
    return allyTokens.filter(token => token.actor !== actor && Math.abs((token.at ?? 0) - at(actor)) <= feet);
  }),
  getAllNearbyTokens: jest.fn(() => []),
  getHissColumnBonus: () => 0,
  getColonyChangelingEvasionBonus: () => 0,
  pickAllyTargets: jest.fn(async () => []),
}));

jest.unstable_mockModule('./util/compendium-item-picker.mjs', () => ({ findCompendiumItems: jest.fn(async () => []), pickCompendiumItem: jest.fn(async () => null) }));
jest.unstable_mockModule('./sheet-handlers/perk-handler.mjs', () => ({ grantPerkOutright: jest.fn(async () => null) }));

let enemyTokens = [];
jest.unstable_mockModule('./mechanics/combat/nearby-enemies.mjs', () => ({ getNearbyEnemyTokens: jest.fn(() => enemyTokens) }));
jest.unstable_mockModule('./sheet-handlers/power-ranger-handler.mjs', () => ({ onMorph: jest.fn(async () => {}) }));
// The Alteration drop handler: its dialogs answered (dropRefused: closed - nothing made); it records originalId.
let dropRefused = false;
jest.unstable_mockModule('./sheet-handlers/alteration-handler.mjs', () => ({
  onAlterationDrop: jest.fn(async (actor, alteration, dropFunc) => {
    if (dropRefused) {
      return;
    }

    const [made] = await dropFunc();
    await made.update({ 'system.originalId': alteration.uuid.split('.').pop() });
  }),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANG = JSON.parse(readFileSync(join(ROOT, 'lang', 'en.json'), 'utf8')).E20;
const lang = key => LANG[key] ?? key;
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  primeonBlade: 'eocitems/_source/Primeon_Blade_VuvBnBhXQTmr4Tro.json',
  cbrnDefender: 'fffav1items/_source/CBRN_Defender_B6HYPvLAVgCtQk1n.json',
  defenderStep: 'ttsgitems/_source/Defender_Step_X59RRGMww6UZQJ78.json',
  retribution: 'ttsgitems/_source/Retribution_cZtUjIzieAFxTwH2.json',
  stormOfLead: 'jttitems/_source/Storm_of_Lead_Px86Wo4MyldPjl5X.json',
  ordnanceExpert: 'gijcrbitems/_source/Ordnance_Expert_bB7Fiuu6BjIUlAgt.json',
  horseshoes: 'gijcrbitems/_source/Horseshoes_and_Handgrenades_NYwpiTjlKxTB2rGF.json',
  mightyStrikes: 'gijcrbitems/_source/Mighty_Strikes_P4agerpRunniHv6G.json',
  noNeedToAim: 'gijcrbitems/_source/No_Need_To_Aim_GHVeLpZ8opWy1Sje.json',
  instillWeakness: 'dditems/_source/Instill_Weakness_o00ALKAEGOlbWXzB.json',
  noFactor: 'qgtgitems/_source/No_Factor_FgiCtgLoTRxFXCeU.json',
  terrifyingPresence: 'gijcrbitems/_source/Terrifying_Presence_Uw1jdm5GzW7Nk5Wi.json',
  terrifyingPresenceTf: 'tfcrbitems/_source/Terrifying_Presence_P4qrmsy7AVSuahwx.json',
  rallyingCry: 'wtnvcgitems/_source/Rallying_Cry_Qdb9Jj4UAAE0YbhE.json',
  uniqueStrikeMelee: 'jttitems/_source/Unique_Strike__Melee__G9dBppUoBQrJgXC4.json',
  uniqueStrikeRanged: 'jttitems/_source/Unique_Strike__Ranged__MZIplpDN4t6ZhFwA.json',
  enhanceStrike: 'jttitems/_source/Enhance_Strike_bPlkdiTAN99QJ1ou.json',
  explosiveAmmo: 'dditems/_source/Explosive_Ammo_UkpZPsRt0YoBHcQl.json',
  firestorm: 'dditems/_source/Firestorm_6AoPBHXLoPhbAR8M.json',
  utilityLoaders: 'dditems/_source/Utility_Loaders_mbY2W9jiPWsDvyMt.json',
  backblast: 'dditems/_source/Backblast_mDG1CXQA04xKfONn.json',
  airburst: 'dditems/_source/Airburst_OoZKK4FARbTreck7.json',
  kitbashUpgrade: 'gijcrbitems/_source/Kitbash_Upgrade_7JNvIGhT0awimmtY.json',
  armamentUpgrade: 'iafav2items/_source/Armament_Upgrade_rmQqGaQ3sqPwEQZy.json',
  trapsAndObstacles: 'eocitems/_source/Traps_and_Obstacles_mNVPUeKWqlQo3QIB.json',
  gridConnection: 'fgtaaitems/_source/Grid_Connection_UDs3dGehEYL5dgbr.json',
  knuckleUp: 'sssitems/_source/Knuckle_Up_MViU1s9KdZ1A51Qe.json',
  poisonous: 'ccitems/_source/Poisonous_9kQxCeLIm10zB1h7.json',
  intoxicate: 'ccitems/_source/Intoxicate_uoNrrDfkqk5pKnwC.json',
  poisonTipped: 'ccitems/_source/Poison_Tipped_Kgcm0HoMe5wuVfuv.json',
  iveGotYou: 'gijcrbitems/_source/I_ve_Got_You_6wbY17kDGkxeGBPp.json',
  upAndAtEm: 'gijcrbitems/_source/Up_And_At__Em_BYVxcL7hWHPDsIJL.json',
  support: 'gijcrbitems/_source/Support_KyEof2TD2V4WTQB4.json',
  techSupport: 'gijcrbitems/_source/Tech_Support_SSLI0YINSvI554Bi.json',
  welds: 'dditems/_source/Welds__Rivets__and_Ideas_a7KiUNWgLZgtQz6S.json',
  whyDoIKnowThat: 'atsitems/_source/Why_Do_I_know_That__ugJU6pzzWNesCn4f.json',
  digDeep: 'prcrbitems/_source/Dig_Deep_eC0iByyLbSHQKY2G.json',
  selfPreservation: 'dditems/_source/Self_Preservation_fsy9G9z8cKe3kObg.json',
  scramble: 'tfcrbitems/_source/Scramble_Lo0GW0XGQ7caNb4P.json',
  gridElementalAdaptation: 'atsitems/_source/Elemental_Adaptation_5HNnSeIg4JKXiv2F.json',
  interspatialPause: 'jttitems/_source/Interspatial_Pause_InterspatialPaus.json',
  shieldModulation: 'gijcrbitems/_source/Shield_Modulation_16ul4Ev6b9gO5CIN.json',
  massShift: 'tfcrbitems/_source/Mass_Shift_0JiAkBjJzsuezfaI.json',
  modeAttachment: 'tfcrbitems/_source/Mode_Attachment_SgofEgBVvg4josSR.json',
  interpose: 'gijcrbitems/_source/Interpose_srCQjZFTPhm2bK3D.json',
  interposeSots: 'sotsitems/_source/Interpose_rh3eMOKRxZTkOYSo.json',
  bodyShield: 'gijcrbitems/_source/Body_Shield_CBfLvmIWdbLuucts.json',
  heroicSacrifice: 'gijcrbitems/_source/Heroic_Sacrifice_GqxgLMadhmPYJgKq.json',
  goldenGuardian: 'atsitems/_source/Golden_Guardian_dSMZ5wMdu0Xq0VzX.json',
  standByMe: 'mlpcrbitems/_source/Stand_By_Me_LrcbTJQdNJVyu23f.json',
  feBurn: 'bthitems/_source/Fe_BURN__y3RPr4nJWVtCtdil.json',
  cyborg: 'bthitems/_source/Cyborg_rqCybOrg7Bth48Pk.json',
  cyberneticPart: 'ccitems/_source/Cybernetic_Part_wCL3rJOEDZVHVg6g.json',
  enhancedPart: 'ccitems/_source/Enhanced_Part_eT4g9EfrFtvjMqWu.json',
  optimizedPart: 'ccitems/_source/Optimized_Part_zGsTAngJ2HRdKPkz.json',
  engraftedMutation: 'ccitems/_source/Engrafted_Mutation_zuR9YJ2Wy956VGGy.json',
  evolvingMutation: 'ccitems/_source/Evolving_Mutation_7cL4aUwJwqvbhYCz.json',
  outrightMutation: 'ccitems/_source/Outright_Mutation_RcGUjeMpsNDFjwmL.json',
  limitedDeflecting: 'ccitems/_source/Limited_Deflecting_Weapon_KFoF9nEHJrRaJzZA.json',
  standardDeflecting: 'ccitems/_source/Standard_Deflecting_Weapon_Z1OIoelOdyUdtyl7.json',
  technicalGlitch: 'qgtgitems/_source/Technical_Glitch_ipHeh6e5De537NhH.json',
  someAssemblyRequired: 'qgtgitems/_source/Some_Assembly_Required_a9rsM3e8i54VoEPI.json',
  shapeShift: 'dsoeitems/_source/Shape_Shift_yi2Z2ebEmTuow5LL.json',
  faceShift: 'dsoeitems/_source/Face_Shift_E1ZaVoP0yjYfyj6F.json',
  masterMorph: 'dsoeitems/_source/Master_Morph_0fKppLmw0TSNAn5z.json',
  sizeShift: 'dsoeitems/_source/Size_Shift_44UMuF7vQM094oQq.json',
  bringItAllDown: 'dditems/_source/Bring_It_All_Down_x4PS0cKR25og3lC0.json',
  multimorph: 'dsoeitems/_source/Multimorph_HGKHAbwZ43I564vd.json',
  patchUp: 'tfcrbitems/_source/Patch_Up_Jlfb8iPvT7JFvcxv.json',
  defibrillator: 'gijcrbitems/_source/Defibrillator_IP0hnNhERC4OCc0k.json',
  shieldUpgrade: 'gijcrbitems/_source/Shield_Upgrade_ep0OFsU1QIuRpHeR.json',
  machineMantle: 'pradvitems/_source/Imperial_Machine_Mantle_CjYzIg9gVstsE0wg.json',
};

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
  item.setFlag = jest.fn(async (scope, key, value) => setPath(item, `flags.${scope}.${key}`, value));
  item.getFlag = (scope, key) => getPath(item.flags?.[scope], key);
  ALL.push(item);
  return item;
}

const C = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;

function packItem(key, extra = {}) {
  const doc = fromPack(FILES[key]);
  return makeItem({
    name: doc.name, type: doc.type, img: doc.img, system: { ...JSON.parse(JSON.stringify(doc.system)), ...(extra.system ?? {}) },
    flags: { core: { sourceId: extra.source ?? `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...(extra.flags ?? {}) } },
  });
}

const sourced = (id, data = {}) => makeItem({ name: data.name ?? 'Item', type: data.type ?? 'perk', flags: { core: { sourceId: `Compendium.essence20.x.Item.${id}` }, essence20: { ...(data.flags ?? {}) } }, system: data.system ?? {} });

function makeActor(items = [], extra = {}) {
  const list = [];
  const actor = {
    id: extra.id ?? `a${nextId++}`, name: extra.name ?? 'Hero', type: extra.type ?? 'playerCharacter', isOwner: true, documentName: 'Actor',
    flags: { essence20: { ...(extra.flags ?? {}) } }, statuses: new Set(extra.statuses ?? []),
    system: {
      level: 10, size: 'common', skills: {}, health: { max: 10, value: 10, bonus: 0 }, powers: { personal: { value: 3, max: 5 } },
      energon: { normal: { value: 2, max: 5 } }, resistances: {},
      defenses: { toughness: { total: 12, string: '12', armor: 2, morphed: 4 }, evasion: { total: 11, string: '11' }, willpower: { total: 13, string: '13' }, cleverness: { total: 15, string: '15' } },
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
  actor.createEmbeddedDocuments = jest.fn(async (type, datas) => {
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
    for (const id of ids) {
      const at = list.findIndex(i => i.id == id);
      if (at >= 0) {
        list.splice(at, 1);
      }
    }

    rebuildIndex(actor);
  });
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
const { runUse, useAvailable, fireTriggers, fireItemAdded } = await import('./triggers.mjs');
const { ruleDerived, ruleRollSources, ruleDialogSwitches, ruleDamageTaken } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { bankedSources } = await import('./bank.mjs');
const { registerCheck, markOf } = await import('./predicate.mjs');
const { beforeRoll } = await import('./plugins/dialog/dialog-select.mjs');
const { markedTargetSources } = await import('./plugins/marks/rule-marks.mjs');
const { successToCrit, runSuccessToCritSteps } = await import('./plugins/rolls/success-to-crit.mjs');
const { stunDefeated } = await import('./plugins/combat/stun-defeat-event.mjs');
const { ruleIgnoresTrait } = await import('./plugins/combat/trait-ignore.mjs');
const { getFanningMaxShots, getFanningFirstShotUpshift, getFanningShotShifts } = await import('../items/attacks/fanning.mjs');
const { allyDefenseReactions, allyDefenseOutcome, fireAllyDefended } = await import('./plugins/combat/ally-reactions.mjs');
// essence20.mjs registers this check (mechanics/combat/multiple-targets.mjs#isMultipleTargetsWeapon); here: the weapon's trait.
registerCheck('multipleTargetsWeapon', (actor, option, ctx) => (ctx?.item ? !!ctx.item.system?.multipleTargets : null));
// And this one (items/forms/pony-shape-shifting.mjs#shapeOf).
const { shapeOf } = await import('../items/forms/pony-shape-shifting.mjs');
registerCheck('shapeShifted', actor => !!shapeOf(actor));

const pay = jest.fn(async () => true);
let chooses = [];
const ask = async (step, options) => {
  const want = chooses.shift();
  const at = options.findIndex(option => option.label == want);
  return at < 0 ? null : at;
};

let numbers = [];
const use = item => runUse(item, pay, { ask });
const available = item => item.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.type == 'Use')
  .some(({ rule, index }) => useAvailable(item, rule, index));
const posted = () => ChatMessage.create.mock.calls.map(call => call[0]);
const buttons = () => posted().map(data => data.flags?.essence20?.ruleButton).filter(Boolean);
/** Press a posted rule button: run its steps as the holder, with its targets. */
async function press(button, actor, item, extra = {}) {
  const ctx = stepContext({ actor, item, targets: button.targets.map(uuid => ALL.find(doc => doc.uuid == uuid)).filter(Boolean), ask, ...extra });
  Object.assign(ctx.vars, button.vars ?? {});
  return runSteps(button.steps, ctx);
}

const effect = (actor, data = {}) => {
  const one = makeItem({ name: data.name ?? 'Attack', type: 'weaponEffect', flags: { essence20: { ...(data.parentId ? { parentId: data.parentId } : {}) } },
    system: { classification: { style: data.style ?? 'melee', skill: data.skill ?? 'might' }, damageType: data.damageType ?? 'blunt', damageValue: 1, totalReach: data.totalReach ?? 5, range: data.range ?? {}, numHands: data.numHands ?? 1, ...(data.system ?? {}) } });
  one.parent = actor;
  actor.items.contents.push(one);
  rebuildIndex(actor);
  return one;
};

const weapon = (actor, data = {}) => {
  const one = makeItem({ name: data.name ?? 'Weapon', type: 'weapon', system: { equipped: true, traits: data.traits ?? [], classification: { size: data.size ?? 'medium' } } });
  one.parent = actor;
  actor.items.contents.push(one);
  rebuildIndex(actor);
  return one;
};

const hit = (actor, target, roll, results = [{ success: true, damageValue: 2 }], outcome = 'success') => fireTriggers(actor, 'hit', { roll, outcome, targets: [target], facts: { results, isCrit: false, isFumble: false } });

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = getPath;
  global.foundry.utils.deepClone = value => JSON.parse(JSON.stringify(value));
});

beforeEach(() => {
  picks = [];
  dropRefused = false;
  caught = [];
  shapes.length = 0;
  allyTokens = [];
  enemyTokens = [];
  offered = [];
  rolls = [];
  chooses = [];
  numbers = [];
  rollsMade.length = 0;
  conditions.length = 0;
  dealt.length = 0;
  vsMany.length = 0;
  temp.length = 0;
  granted.length = 0;
  CATALOG.length = 0;
  ALL.length = 0;
  pay.mockClear();
  global.foundry.applications.api.DialogV2 = { wait: jest.fn(async () => null), prompt: jest.fn(async () => numbers.shift() ?? null), confirm: jest.fn(async () => true) };
  global.game.user = { id: 'u1', isGM: true, targets: new Set() };
  global.game.users = [];
  global.game.combat = null;
  global.game.settings = { get: () => 1, set: async () => {} };
  global.game.actors = ALL.filter(doc => doc.documentName == 'Actor');
  global.game.i18n = { localize: k => k, format: k => k, has: () => false };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid) ?? ALL.find(doc => doc.uuid == uuid);
    return found ? { ...found, toObject: () => JSON.parse(JSON.stringify({ name: found.name, type: found.type, system: found.system })) } : null;
  });
  global.fromUuidSync = jest.fn(uuid => ALL.find(doc => doc.uuid == uuid) ?? null);
  global.CONFIG.E20.actorReach = { small: 2, common: 5, large: 10, huge: 10 };
  global.CONFIG.E20.skillToEssence = { athletics: 'strength', might: 'strength', technology: 'smarts', science: 'smarts', performance: 'social', intimidation: 'strength', persuasion: 'social', brawn: 'strength' };
  global.CONFIG.E20.elementDamageTypes = { acid: 'E20.DamageAcid', fire: 'E20.DamageFire' };
  global.CONFIG.E20.skills = { athletics: 'E20.SkillAthletics', might: 'E20.SkillMight' };
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
/*  Attacks                                      */
/* -------------------------------------------- */

describe('attacks', () => {
  test('Primeon Blade: a damaging hit on a Combiner offers each component 1 extra Element damage (one button each)', async () => {
    const attacker = makeActor([], { name: 'Bot' });
    const blade = packItem('primeonBlade');
    blade.parent = attacker;
    attacker.items.contents.push(blade);
    rebuildIndex(attacker);
    const slash = effect(attacker, { parentId: blade.id });
    const member = makeActor([], { name: 'Member', type: 'npc' });
    const zord = makeActor([], { name: 'Zord', type: 'zord' });
    const combiner = makeActor([], { name: 'Combiner', type: 'megaform', system: { subtype: ['megaformCombiner'], actors: { a: { uuid: member.uuid }, b: { uuid: zord.uuid } } } });
    await hit(attacker, combiner, { item: slash, isAttack: true }, [{ success: true, damageValue: 0 }]);
    expect(buttons()).toEqual([]);
    await hit(attacker, combiner, { item: slash, isAttack: true });
    expect(buttons().map(b => b.label)).toEqual(['Primeon Blade: Member']);
    await press(buttons()[0], attacker, blade);
    expect(dealt).toEqual([{ name: 'Member', amount: 1, type: 'element' }]);

    ChatMessage.create.mockClear();
    const megazord = makeActor([], { name: 'Megazord', type: 'megaform', system: { subtype: ['megaformZord'], actors: { b: { uuid: zord.uuid } } } });
    await hit(attacker, megazord, { item: slash, isAttack: true });
    await hit(attacker, makeActor([], { name: 'Foe' }), { item: slash, isAttack: true });
    const other = effect(attacker, { name: 'Other' });
    await hit(attacker, combiner, { item: other, isAttack: true });
    expect(buttons()).toEqual([]);
  });

  test('CBRN Defender: Defeating someone (Health or a Stun auto-Defeat) gives ↓1 on attacks for the rest of the combat', async () => {
    const hangUp = packItem('cbrnDefender');
    const actor = makeActor([hangUp]);
    const fist = effect(actor);
    const foe = makeActor([], { name: 'Foe' });
    const down = () => ruleRollSources(actor, null, { item: fist, isAttack: true, isMelee: true }).sources.filter(s => /CBRN/.test(s.label));
    expect(down()).toEqual([]);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    await fireTriggers(actor, 'defeatedEnemy', { targets: [foe] });
    expect(down()).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    expect(ruleRollSources(actor, null, { item: null, rolledSkill: 'athletics' }).sources.some(s => /CBRN/.test(s.label))).toBe(false);
    global.game.combat = { id: 'c2', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    expect(down()).toEqual([]);

    // A Stun hit that Defeats (combat.mjs#applyDamage's auto-Defeat) fires defeatedEnemyStun on the dealer.
    await stunDefeated(foe, actor);
    expect(down()).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    await stunDefeated(actor, actor);
    await stunDefeated(foe, null);
  });

  test('Storm of Lead: Fanning X +1 and the first fanned shot ↑1', () => {
    const fanning = { system: { traits: ['fanning'], fanningMagnitude: 2 } };
    const plain = makeActor();
    expect([getFanningMaxShots(plain, fanning), getFanningFirstShotUpshift(plain)]).toEqual([2, 0]);
    const actor = makeActor([packItem('stormOfLead')]);
    expect([getFanningMaxShots(actor, fanning), getFanningMaxShots(actor, { system: { traits: ['ballistic'] } })]).toEqual([3, 0]);
    expect(getFanningShotShifts(1, getFanningFirstShotUpshift(actor))).toEqual({ shiftUp: 1, shiftDown: 1 });
    expect(getFanningShotShifts(2, getFanningFirstShotUpshift(actor))).toEqual({ shiftUp: 0, shiftDown: 2 });
  });

  test('Ordnance Expert: Mounted weapons count as set up', () => {
    const gun = { name: 'Gun', type: 'weapon', system: { traits: ['mounted'] } };
    expect(ruleIgnoresTrait(makeActor(), gun, 'mounted')).toBe(false);
    expect(ruleIgnoresTrait(makeActor([packItem('ordnanceExpert')]), gun, 'mounted')).toBe(true);
    expect(ruleIgnoresTrait(null, gun, 'mounted')).toBe(false);
  });

  test('Horseshoes and Handgrenades: an explosive Area attack deals 1 damage of its type to everyone it caught, before the roll', async () => {
    const actor = makeActor([packItem('horseshoes')]);
    const grenade = effect(actor, { style: 'explosive', damageType: 'fire', system: { shape: 'circle' } });
    const a = makeActor([], { name: 'A' });
    const b = makeActor([], { name: 'B' });
    global.game.user.targets = new Set([{ actor: a }, { actor: b }, { actor: null }]);
    await beforeRoll(actor, { skill: 'athletics' }, grenade);
    expect(dealt).toEqual([{ name: 'A', amount: 1, type: 'fire' }, { name: 'B', amount: 1, type: 'fire' }]);
    dealt.length = 0;
    await beforeRoll(actor, { skill: 'athletics', concentratedFire: true }, grenade);
    await beforeRoll(actor, { skill: 'athletics' }, effect(actor, { style: 'explosive', damageType: 'fire' }));
    await beforeRoll(actor, { skill: 'athletics' }, effect(actor, { style: 'projectile', system: { shape: 'cone' } }));
    await beforeRoll(makeActor(), { skill: 'athletics' }, grenade);
    expect(dealt).toEqual([]);
  });

  test('Mighty Strikes: a Might melee attack targets every token within its Reach (not the attacker)', async () => {
    const actor = makeActor([packItem('mightyStrikes')]);
    const own = { id: 't0', center: { x: 100, y: 100 }, actor };
    actor.getActiveTokens = () => [own];
    const foe = makeActor([], { name: 'Foe' });
    const friend = makeActor([], { name: 'Friend' });
    caught = [own, { id: 't1', actor: foe }, { id: 't2', actor: friend }];
    const setTargets = jest.fn();
    global.canvas = { tokens: { setTargets, placeables: [] } };
    const club = effect(actor, { skill: 'might', totalReach: 10 });
    await beforeRoll(actor, { skill: 'might' }, club);
    expect(shapes).toEqual([{ type: 'circle', x: 100, y: 100, radius: 100 }]);
    expect(setTargets).toHaveBeenCalledWith(['t1', 't2']);
    setTargets.mockClear();
    await beforeRoll(actor, { skill: 'finesse' }, effect(actor, { skill: 'finesse' }));
    await beforeRoll(actor, { skill: 'might' }, effect(actor, { skill: 'might', style: 'projectile' }));
    actor.getActiveTokens = () => [];
    await beforeRoll(actor, { skill: 'might' }, club);
    expect(setTargets).not.toHaveBeenCalled();
  });

  test('No Need To Aim: a Multiple Targets attack deals 1 damage of its type to each current target', async () => {
    const actor = makeActor([packItem('noNeedToAim')]);
    const burst = effect(actor, { style: 'projectile', damageType: 'sharp', system: { multipleTargets: true } });
    global.game.user.targets = new Set([{ actor: makeActor([], { name: 'A' }) }]);
    await beforeRoll(actor, { skill: 'athletics' }, burst);
    expect(dealt).toEqual([{ name: 'A', amount: 1, type: 'sharp' }]);
    dealt.length = 0;
    await beforeRoll(actor, { skill: 'athletics' }, effect(actor, { style: 'projectile' }));
    expect(dealt).toEqual([]);
  });

  test('Instill Weakness: a Technology success spends 1 Energon and marks the target with a damage type; attacks of that type against it gain Edge', async () => {
    global.CONFIG.E20.damageTypes = { fire: 'E20.DamageFire', sharp: 'E20.DamageSharp' };
    const perk = packItem('instillWeakness');
    const actor = makeActor([perk]);
    const sw = () => ruleDialogSwitches(actor, { rolledSkill: 'technology' }).find(s => /Instill/.test(s.label));
    expect(sw()).toBeTruthy();
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' }).some(s => /Instill/.test(s.label))).toBe(false);
    const target = makeActor([], { name: 'Foe' });
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'technology', switches: [] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    expect(target.flags.essence20.ruleMarks).toBeUndefined();
    picks = ['fire'];
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'technology', switches: ['instillWeakness'] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    expect(actor.system.energon.normal.value).toBe(1);
    expect(target.flags.essence20.ruleMarks.instillWeakness).toMatchObject({ by: actor.uuid, until: 'scene', text: 'fire' });

    // Anyone's attack of that type against the marked creature gains Edge; another type doesn't.
    const ally = makeActor([], { name: 'Ally' });
    const torch = effect(ally, { damageType: 'fire' });
    const knife = effect(ally, { damageType: 'sharp' });
    expect(markedTargetSources(ally, target, { item: torch }).sources).toEqual([expect.objectContaining({ edge: true, label: 'Instill Weakness' })]);
    expect(markedTargetSources(ally, target, { item: knife }).sources).toEqual([]);
    expect(markedTargetSources(ally, makeActor([], { name: 'Other' }), { item: torch }).sources).toEqual([]);

    // No Energon left: no prompt, no mark, no switch.
    actor.system.energon.normal.value = 0;
    const second = makeActor([], { name: 'Second' });
    picks = ['fire'];
    await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'technology', switches: ['instillWeakness'] }, outcome: 'success', targets: [second], facts: { results: [{ success: true }] } });
    expect(second.flags.essence20.ruleMarks).toBeUndefined();
    expect(sw()).toBeUndefined();
  });

  test('No Factor: a Deception success marks the target fooled; a plain success against a fooled enemy is a Critical Success and ends the disguise for all', async () => {
    const actor = makeActor([packItem('noFactor')]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'deception' }).some(s => /No Factor/.test(s.label))).toBe(true);
    const a = makeActor([], { name: 'A' });
    const b = makeActor([], { name: 'B' });
    global.game.actors = ALL.filter(doc => doc.documentName == 'Actor');
    for (const target of [a, b]) {
      await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'deception', switches: ['noFactor'] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] } });
    }

    const applied = [];
    expect(successToCrit(actor, { targetUuid: makeActor([], { name: 'C' }).uuid }, {}, applied)).toBe(false);
    expect(successToCrit(makeActor(), { targetUuid: a.uuid }, {}, [])).toBe(false);
    expect(successToCrit(actor, { targetUuid: a.uuid }, { isAttack: true }, applied)).toBe(true);
    expect(applied).toHaveLength(1);
    await runSuccessToCritSteps(actor, applied);
    expect(Object.keys(a.flags.essence20.ruleMarks ?? {})).toEqual([]);
    expect(Object.keys(b.flags.essence20.ruleMarks ?? {})).toEqual([]);
    expect(successToCrit(actor, { targetUuid: b.uuid }, {}, [])).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Checks with riders, designed attacks         */
/* -------------------------------------------- */

describe('Terrifying Presence, Rallying Cry', () => {
  const afterRoll = (actor, roll, results, extra = {}) => fireTriggers(actor, 'afterRoll', {
    roll: { rolledSkill: 'intimidation', targetCount: results.filter(r => r.targetUuid).length, ...roll }, outcome: results.some(r => r.success) ? 'success' : 'failure',
    facts: { results, isCrit: !!extra.crit, isFumble: false }, vars: { crit: extra.crit ? 1 : 0, targets: results.length },
  });

  test('GI Joe printing: an Intimidation roll against Willpower asks for a rider - +1 Psychic card damage, or Frightened / Stunned on the first target hit', async () => {
    const actor = makeActor([packItem('terrifyingPresence')]);
    const dataset = { skill: 'intimidation', defenseType: 'willpower' };
    chooses = ['Inflict 1 additional damage'];
    global.foundry.applications.api.DialogV2.wait = jest.fn(async (config) => {
      const want = chooses.shift();
      return config.buttons.findIndex(button => button.label == want);
    });
    await beforeRoll(actor, dataset, null);
    expect(dataset.stepDamage).toEqual({ value: 1, type: 'psychic' });

    const plain = { skill: 'intimidation', defenseType: 'evasion' };
    await beforeRoll(actor, plain, null);
    await beforeRoll(actor, { skill: 'persuasion', defenseType: 'willpower' }, null);
    expect(plain.stepDamage).toBeUndefined();
    expect(global.foundry.applications.api.DialogV2.wait).toHaveBeenCalledTimes(1);

    const stun = { skill: 'intimidation', defenseType: 'willpower' };
    chooses = ['Stun the target for one round'];
    await beforeRoll(actor, stun, null);
    expect(stun).toMatchObject({ terrifyingPresence: 'stunned' });
    const foe = makeActor([], { name: 'Foe' });
    const other = makeActor([], { name: 'Other' });
    global.game.user.targets = new Set([{ actor: foe }, { actor: other }]);
    await afterRoll(actor, { dataset: stun }, [{ success: false, targetUuid: foe.uuid }, { success: true, targetUuid: other.uuid }]);
    expect(conditions).toEqual([]);
    await afterRoll(actor, { dataset: stun }, [{ success: true, targetUuid: foe.uuid }, { success: true, targetUuid: other.uuid }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'stunned', rounds: 0 }]);
    conditions.length = 0;
    await afterRoll(actor, { dataset: { terrifyingPresence: 'frightened' } }, [{ success: true, targetUuid: foe.uuid }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'frightened', rounds: 0 }]);

    // Cancelling the picker: no rider, the roll goes on.
    const cancelled = { skill: 'intimidation', defenseType: 'willpower' };
    chooses = [];
    await beforeRoll(actor, cancelled, null);
    expect(cancelled.cancelRoll).toBeUndefined();
    expect(cancelled.stepDamage).toBeUndefined();
  });

  test('Transformers printing: the third option is 1 Stun damage; holding both, only the GI Joe one asks', async () => {
    global.foundry.applications.api.DialogV2.wait = jest.fn(async (config) => {
      const want = chooses.shift();
      return config.buttons.findIndex(button => button.label == want);
    });
    const tf = makeActor([packItem('terrifyingPresenceTf')]);
    const dataset = { skill: 'intimidation', defenseType: 'willpower' };
    chooses = ['Deal 1 Stun damage'];
    await beforeRoll(tf, dataset, null);
    expect(dataset.stepDamage).toEqual({ value: 1, type: 'stun' });

    const both = makeActor([packItem('terrifyingPresenceTf'), packItem('terrifyingPresence', { source: 'Compendium.essence20.gi_joe_crb.Item.Uw1jdm5GzW7Nk5Wi' })]);
    global.foundry.applications.api.DialogV2.wait.mockClear();
    chooses = ['Stun the target for one round'];
    const second = { skill: 'intimidation', defenseType: 'willpower' };
    await beforeRoll(both, second, null);
    expect(global.foundry.applications.api.DialogV2.wait).toHaveBeenCalledTimes(1);
    expect(second.terrifyingPresence).toBe('stunned');
    const foe = makeActor([], { name: 'Foe' });
    global.game.user.targets = new Set([{ actor: foe }]);
    await afterRoll(both, { dataset: { terrifyingPresence: 'frightened' } }, [{ success: true, targetUuid: foe.uuid }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'frightened', rounds: 0 }]);
  });

  test('Rallying Cry (WTNV): a DIF 10 Performance success in round 1 Surprises one enemy target - three on a Critical Success', async () => {
    const actor = makeActor([packItem('rallyingCry')]);
    const own = { document: { disposition: 1 } };
    actor.getActiveTokens = () => [own];
    const side = disposition => () => [{ document: { disposition } }];
    const ally = Object.assign(makeActor([], { name: 'Ally' }), { getActiveTokens: side(1) });
    const foes = ['A', 'B', 'C', 'D'].map(name => Object.assign(makeActor([], { name }), { getActiveTokens: side(-1) }));
    global.game.user.targets = new Set([ally, ...foes].map(one => ({ actor: one })));
    const roll = (dif, results, crit = false) => fireTriggers(actor, 'afterRoll', {
      roll: { rolledSkill: 'performance', dataset: { dif } }, outcome: crit ? 'crit' : results[0].success ? 'success' : 'failure',
      facts: { results, isCrit: crit, isFumble: false }, vars: { crit: crit ? 1 : 0 },
    });
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, combatants: [], turns: [] };
    await roll('10', [{ success: true }]);
    expect(conditions).toEqual([]);
    global.game.combat.round = 1;
    await roll('12', [{ success: true }]);
    await roll('10', [{ success: false }]);
    expect(conditions).toEqual([]);
    await roll('10', [{ success: true }]);
    expect(conditions.map(c => c.name)).toEqual(['A']);
    conditions.length = 0;
    await roll('10', [{ success: true }], true);
    expect(conditions.map(c => [c.name, c.status])).toEqual([['A', 'surprised'], ['B', 'surprised'], ['C', 'surprised']]);
  });
});

describe('Unique Strike, Enhance Strike', () => {
  const created = actor => actor.items.contents.filter(item => ['weapon', 'weaponEffect'].includes(item.type));

  test('Unique Strike (Melee): the design (name, Skill, damage type, Alternate Effect) becomes an integrated weapon with its flagged attack', async () => {
    global.CONFIG.E20.damageTypes = { fire: 'E20.DamageFire', blunt: 'E20.DamageBlunt' };
    const perk = packItem('uniqueStrikeMelee');
    const actor = makeActor([perk]);
    numbers = ['Thunder Fist'];
    picks = ['might', 'fire'];
    chooses = ['Maneuver (↓1)'];
    await fireItemAdded(actor, perk, { ask });
    const [weapon, attack] = created(actor);
    expect(weapon).toMatchObject({ name: 'Thunder Fist', type: 'weapon', system: { classification: { size: 'integrated' }, equipped: true } });
    expect(attack.flags.essence20).toMatchObject({ parentId: weapon.id, isUniqueStrike: true, grantedBy: perk.id });
    expect(attack.system).toMatchObject({ classification: { skill: 'might', style: 'melee' }, damageType: 'maneuver', damageValue: 1, numTargets: 1, shiftDown: 1, accurateShiftUp: 0, radius: 0 });
    expect(attack.system.range).toEqual({ min: null, reachMultiplier: 1, long: null, value: null });

    const second = makeActor([packItem('uniqueStrikeMelee')]);
    numbers = ['Jab'];
    picks = ['finesse', 'blunt'];
    chooses = ['Multiple Attacks (2, ↓1)'];
    await fireItemAdded(second, second.items.contents[0], { ask });
    expect(created(second)[1].system).toMatchObject({ classification: { skill: 'finesse' }, damageType: 'blunt', numTargets: 2, shiftDown: 1 });

    // Cancelled part way: nothing is made.
    const third = makeActor([packItem('uniqueStrikeMelee')]);
    numbers = ['Swipe'];
    picks = ['might'];
    await fireItemAdded(third, third.items.contents[0], { ask });
    expect(created(third)).toEqual([]);
  });

  test('Unique Strike (Ranged): Element damage, the chosen Range and Alternate Effect', async () => {
    const perk = packItem('uniqueStrikeRanged');
    const actor = makeActor([perk]);
    numbers = ['Bolt'];
    picks = ['targeting'];
    chooses = ['30ft optimal, 60ft long', 'Accurate (↑1)'];
    await fireItemAdded(actor, perk, { ask });
    const attack = created(actor)[1];
    expect(attack.system).toMatchObject({ classification: { skill: 'targeting', style: 'element' }, damageType: 'element', accurateShiftUp: 1, numTargets: 1, radius: 0, shape: null });
    expect(attack.system.range).toEqual({ min: null, reachMultiplier: 1, long: 60, value: 30 });

    const burst = makeActor([packItem('uniqueStrikeRanged')]);
    numbers = ['Nova'];
    picks = ['athletics'];
    chooses = ['All enemies within 10ft of you', 'Armor Piercing'];
    await fireItemAdded(burst, burst.items.contents[0], { ask });
    expect(created(burst)[1].system).toMatchObject({ radius: 10, shape: 'burst', hasArmorPiercing: 1, range: { long: null, value: null } });
  });

  test('Enhance Strike: +1 damage, an Element, +10 ft Range (ranged only) or an Alternate Effect it lacks, on a Unique Strike', async () => {
    global.CONFIG.E20.elementDamageTypes = { acid: 'E20.DamageAcid', fire: 'E20.DamageFire' };
    const actor = makeActor();
    const strike = effect(actor, { name: 'Bolt', style: 'element', damageType: 'element', system: { range: { value: 30, long: 60 }, numTargets: 1, accurateShiftUp: 1 } });
    strike.flags.essence20.isUniqueStrike = true;
    effect(actor, { name: 'Ordinary' });
    const enhance = () => {
      const perk = packItem('enhanceStrike');
      perk.parent = actor;
      actor.items.contents.push(perk);
      rebuildIndex(actor);
      return fireItemAdded(actor, perk, { ask });
    };

    chooses = ['Increase base damage by +1'];
    await enhance();
    expect(strike.system.damageValue).toBe(2);
    chooses = ['Change damage type to an Element'];
    picks = ['acid'];
    await enhance();
    expect(strike.system.damageType).toBe('acid');
    chooses = ['Add 10ft to Range'];
    await enhance();
    expect(strike.system.range).toMatchObject({ value: 40, long: 70 });

    // Only the Alternate Effects it doesn't have (and that fit a ranged attack) are offered.
    let offeredLabels = [];
    const spy = async (step, options) => {
      offeredLabels.push(options.map(option => option.label));
      return ask(step, options);
    };

    chooses = ['Add an Alternate Effect', 'Multiple Targets (2, ↓1)'];
    const perk = packItem('enhanceStrike');
    perk.parent = actor;
    actor.items.contents.push(perk);
    rebuildIndex(actor);
    await fireItemAdded(actor, perk, { ask: spy });
    expect(offeredLabels[1]).toEqual(['Area of Effect (10ft x 10ft)', 'Armor Piercing', 'Maneuver (↓1)', 'Multiple Targets (2, ↓1)']);
    expect(strike.system).toMatchObject({ numTargets: 2, shiftDown: 1 });

    // A melee Unique Strike: no Range option.
    const melee = makeActor();
    const punch = effect(melee, { name: 'Punch' });
    punch.flags.essence20.isUniqueStrike = true;
    const melPerk = packItem('enhanceStrike');
    melPerk.parent = melee;
    melee.items.contents.push(melPerk);
    rebuildIndex(melee);
    offeredLabels = [];
    chooses = [];
    await fireItemAdded(melee, melPerk, { ask: spy });
    expect(offeredLabels[0]).toEqual(['Increase base damage by +1', 'Change damage type to an Element', 'Add an Alternate Effect']);

    // No Unique Strike: nothing to pick.
    const none = makeActor();
    const nonePerk = packItem('enhanceStrike');
    nonePerk.parent = none;
    none.items.contents.push(nonePerk);
    rebuildIndex(none);
    offeredLabels = [];
    await fireItemAdded(none, nonePerk, { ask: spy });
    expect(offeredLabels).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Allies' reactions before a roll              */
/* -------------------------------------------- */

describe('Defender Step, Swift Defender, Continuous Stance, Retribution', () => {
  const ID = id => sourced(id, { name: id });
  const SWIFT_DEFENDER = 'MPAZdtX3Ob76h90Y';
  const CONTINUOUS_STANCE = 'yNtX8ky7O8v50C5l';

  test('Defender Step: an ally rolled against is offered to the holder (1 Personal Power) - their Defense rises by the Combat Stance number; the first to accept is the only one', async () => {
    const ally = makeActor([], { name: 'Ally' });
    const foe = makeActor([], { name: 'Foe' });
    const magna = makeActor([packItem('defenderStep')], { name: 'Magna' });
    const other = makeActor([packItem('defenderStep')], { name: 'Other' });
    allyTokens = [{ actor: ally }, { actor: magna }, { actor: other }];
    const asked = [];
    const confirm = jest.fn(async (rule, item, names) => {
      asked.push(names);
      return true;
    });
    expect(await allyDefenseReactions(ally, foe, { confirm })).toEqual({ bonus: 1, reactorUuid: magna.uuid });
    expect(asked).toEqual([{ reactor: 'Magna', ally: 'Ally', attacker: 'Foe' }]);
    expect(magna.system.powers.personal.value).toBe(2);
    expect(magna.system.health.bonus).toBe(0);

    // Declined: the next ally holding it is asked. Without Personal Power: not asked at all.
    asked.length = 0;
    confirm.mockImplementationOnce(async (rule, item, names) => {
      asked.push(names);
      return false;
    });
    expect(await allyDefenseReactions(ally, foe, { confirm })).toEqual({ bonus: 1, reactorUuid: other.uuid });
    expect(asked.map(names => names.reactor)).toEqual(['Magna', 'Other']);
    magna.system.powers.personal.value = 0;
    other.system.powers.personal.value = 0;
    asked.length = 0;
    expect(await allyDefenseReactions(ally, foe, { confirm })).toEqual({ bonus: 0, reactorUuid: null });
    expect(asked).toEqual([]);
  });

  test('Swift Defender: +1 temporary Health on each use; Continuous Stance: the boost is 2', async () => {
    const ally = makeActor([], { name: 'Ally' });
    const magna = makeActor([packItem('defenderStep'), ID(SWIFT_DEFENDER), ID(CONTINUOUS_STANCE)], { name: 'Magna' });
    allyTokens = [{ actor: magna }];
    expect(await allyDefenseReactions(ally, makeActor(), { confirm: async () => true })).toEqual({ bonus: 2, reactorUuid: magna.uuid });
    expect([magna.system.powers.personal.value, magna.system.health.bonus]).toEqual([2, 1]);
  });

  test('allyDefended: hit despite the boost, turned by it, or missed anyway (the boosted row\'s raw total against its DIF)', () => {
    const row = { difficulty: 14, defenderStepBonus: 2, defenderStepReactorUuid: 'Actor.x' };
    expect([allyDefenseOutcome(row, 15), allyDefenseOutcome(row, 13), allyDefenseOutcome(row, 11)]).toEqual(['hit', 'turned', 'missed']);
    expect(allyDefenseOutcome({ difficulty: 14 }, 20)).toBeNull();
  });

  test('Retribution: after the step, the next melee attack against that enemy may spend 1 Personal Power for +1 damage (it still hit) or an Edge (the step made it miss)', async () => {
    const magna = makeActor([packItem('retribution')], { name: 'Magna' });
    const foe = makeActor([], { name: 'Foe' });
    const bystander = makeActor([], { name: 'Bystander' });
    global.game.actors = ALL.filter(doc => doc.documentName == 'Actor');
    const club = effect(magna);
    const gun = effect(magna, { style: 'projectile' });
    const switches = (target, item = club) => {
      global.game.user.targets = new Set([{ actor: target }]);
      return ruleDialogSwitches(magna, { item, isAttack: true, isMelee: item === club }).filter(s => /Retribution/.test(s.label));
    };

    expect(switches(foe)).toEqual([]);

    await fireAllyDefended(foe, [{ reactorUuid: magna.uuid, outcome: 'missed' }]);
    expect(switches(foe)).toEqual([]);
    await fireAllyDefended(foe, [{ reactorUuid: magna.uuid, outcome: 'hit' }]);
    expect(switches(foe).map(s => s.label)).toEqual([expect.stringContaining('+1 damage')]);
    expect(switches(bystander)).toEqual([]);
    expect(switches(foe, gun)).toEqual([]);

    // A later Defender Step that turned an attack replaces it (one banked bonus at a time).
    await fireAllyDefended(foe, [{ reactorUuid: magna.uuid, outcome: 'turned' }]);
    expect(switches(foe).map(s => s.label)).toEqual([expect.stringContaining('Edge')]);

    // No Personal Power: not offered.
    magna.system.powers.personal.value = 0;
    expect(switches(foe)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Weapons changed for a while                  */
/* -------------------------------------------- */

describe('weapon Uses: mutations, temporary upgrades, Knuckle Up', () => {
  const C15 = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
  const setup = (key, extra = {}) => {
    const perk = packItem(key);
    const actor = makeActor([perk, ...(extra.items ?? [])], extra.actor ?? {});
    const gun = weapon(actor, { name: 'Rifle', size: 'medium' });
    const shot = effect(actor, { name: 'Shot', style: 'projectile', parentId: gun.id, system: { radius: extra.radius ?? 0 } });
    return { perk, actor, gun, shot };
  };

  const mutation = gun => gun.flags.essence20.mutation;
  const upgradeEntry = (name, availability) => {
    const entry = { uuid: C15('x', name.replace(/\W/g, '')), name, type: 'upgrade', system: { type: 'weapon', availability } };
    CATALOG.push(entry);
    return entry;
  };

  beforeEach(() => {
    global.CONFIG.E20.availabilityDifficulties = { standard: 10, limited: 12, restricted: 14, prototype: 16 };
    global.CONFIG.E20.availabilities = { standard: 'E20.Standard' };
  });

  test('Explosive Ammo: a ranged weapon gets a 10 ft blast (a blast +5 ft) until a Fumble - Free action, 1 Energon; Tooled Munitions picks an Element', async () => {
    const { perk, actor, gun } = setup('explosiveAmmo');
    picks = ['Rifle'];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    expect(actor.system.energon.normal.value).toBe(1);
    expect(mutation(gun)).toEqual({ explosiveAmmo: true, blastAdd: 0, blastSet: 10, untilFumble: true });

    const tooled = setup('explosiveAmmo', { items: [sourced('g3hbfgEElXvJP6x9', { name: 'Tooled Munitions' })], radius: 10 });
    picks = ['Rifle', 'fire'];
    await use(tooled.perk);
    expect(mutation(tooled.gun)).toEqual({ explosiveAmmo: true, blastAdd: 5, blastSet: 0, untilFumble: true, damageType: 'fire' });

    // No Energon: no button. A melee-only weapon isn't offered.
    actor.system.energon.normal.value = 0;
    expect(available(perk)).toBe(false);
    const melee = setup('explosiveAmmo');
    melee.shot.system.classification.style = 'melee';
    rebuildIndex(melee.actor);
    picks = ['Rifle'];
    await use(melee.perk);
    expect(melee.gun.flags.essence20.mutation).toBeUndefined();
  });

  test('Firestorm: only on a weapon Explosive Ammo changed, in combat - its next blast triples', async () => {
    const { perk, gun } = setup('firestorm');
    expect(available(perk)).toBe(false);
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    picks = ['Rifle'];
    await use(perk);
    expect(mutation(gun)).toBeUndefined();
    gun.flags.essence20.mutation = { explosiveAmmo: true };
    picks = ['Rifle'];
    await use(perk);
    expect(mutation(gun)).toEqual({ explosiveAmmo: true, tripleNext: true });
  });

  test('Utility Loaders: a damage type, a trait or Stun instead, the last choice standing (Explosive Ammo kept)', async () => {
    const { perk, gun } = setup('utilityLoaders');
    gun.flags.essence20.mutation = { explosiveAmmo: true, blastSet: 10, damageType: 'fire' };
    picks = ['Rifle'];
    chooses = ['Add trait: Wrecker'];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('free');
    expect(mutation(gun)).toEqual({ explosiveAmmo: true, blastSet: 10, damageType: null, addTraits: ['wrecker'], stunInstead: null, untilFumble: true });
    picks = ['Rifle'];
    chooses = ['Damage type: Sharp'];
    await use(perk);
    expect(mutation(gun)).toMatchObject({ damageType: 'sharp', addTraits: [], stunInstead: null });
    picks = ['Rifle'];
    chooses = ['Deal Stun equal to its damage'];
    await use(perk);
    expect(mutation(gun)).toMatchObject({ damageType: null, addTraits: [], stunInstead: 1 });
  });

  test('Backblast: a switch on a blast weapon; Airburst: 1 Energon (no action), in combat, for the next attack', async () => {
    const { perk, gun } = setup('backblast', { radius: 10 });
    picks = ['Rifle'];
    expect(await use(perk)).toContain('Backblast on');
    expect(mutation(gun)).toEqual({ backblast: true });
    picks = ['Rifle'];
    expect(await use(perk)).toContain('Backblast off');
    expect(mutation(gun)).toEqual({ backblast: false });

    const air = setup('airburst', { radius: 10 });
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    pay.mockClear();
    picks = ['Rifle'];
    await use(air.perk);
    expect(pay).not.toHaveBeenCalled();
    expect(air.actor.system.energon.normal.value).toBe(1);
    expect(mutation(air.gun)).toEqual({ airburstNext: true });
  });

  test('Kitbash Upgrade: a Standard action and a Technology Test against the upgrade\'s DIF fit it for 10 rounds; Armament Upgrade: DIF 10 + it, until the end of the next turn', async () => {
    upgradeEntry('Scope', 'limited');
    upgradeEntry('Prototype Barrel', 'prototype');
    const { perk, actor, gun } = setup('kitbashUpgrade');
    picks = ['Rifle', 'Scope'];
    rolls = [{ success: false }];
    expect(await use(perk)).toContain('Kitbash Upgrade fails');
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 12 }]);
    expect(actor.items.contents.some(item => item.name == 'Scope')).toBe(false);
    picks = ['Rifle', 'Scope'];
    rolls = [{ success: true }];
    await use(perk);
    expect(pay).toHaveBeenCalledWith('standard');
    const scope = actor.items.contents.find(item => item.name == 'Scope');
    expect(scope.flags.essence20).toMatchObject({ parentId: gun.id, temporary: { kind: 'rounds', rounds: 10, source: 'Kitbash Upgrade' } });

    const arm = setup('armamentUpgrade');
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    offered = [];
    rollsMade.length = 0;
    picks = ['Rifle', 'Scope'];
    rolls = [{ success: true }];
    await use(arm.perk);
    expect(offered[1]).toEqual(['Scope']);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 22 }]);
    expect(arm.actor.items.contents.find(item => item.name == 'Scope').flags.essence20.temporary).toMatchObject({ kind: 'nextTurn' });
  });

  test('Traps and Obstacles: a non-Integrated weapon gets a Proximity Bomb, used up by its next attack (Standard action, 1 Energon)', async () => {
    CATALOG.push({ uuid: 'Compendium.essence20.tf_crb.Item.I2nS9xXN8ioV5jJ5', name: 'Proximity Bomb', type: 'upgrade', system: { type: 'weapon' } });
    const { perk, actor, gun } = setup('trapsAndObstacles');
    const claws = weapon(actor, { name: 'Claws', size: 'integrated' });
    picks = ['Rifle'];
    await use(perk);
    expect(offered[0]).toEqual(['Rifle']);
    expect(actor.system.energon.normal.value).toBe(1);
    expect(actor.items.contents.find(item => item.name == 'Proximity Bomb').flags.essence20).toMatchObject({ parentId: gun.id, temporary: { kind: 'untilUsed' } });
    expect(claws).toBeTruthy();
  });

  test('Grid Connection: the Power Weapon gets an upgrade of the level\'s tier for the scene and the light armor shell; +1 Personal Power maximum', async () => {
    upgradeEntry('Scope', 'limited');
    upgradeEntry('Sling', 'standard');
    upgradeEntry('Prototype Barrel', 'restricted');
    const { perk, actor, gun } = setup('gridConnection', { actor: { system: { level: 12 } } });
    picks = ['Rifle', 'Scope'];
    await use(perk);
    expect(offered[1]).toEqual(['Scope', 'Sling']);
    expect(actor.items.contents.find(item => item.name == 'Scope').flags.essence20).toMatchObject({ parentId: gun.id, temporary: { kind: 'scene' } });
    expect(markOf(actor, 'gridShell')).toBe(true);
    const { isGridShellActive } = await import('../items/attacks/weapon-perk-uses.mjs');
    expect(isGridShellActive(actor)).toBe(true);
    ruleDerived(actor);
    expect(actor.system.powers.personal.max).toBe(6);
  });

  test('Knuckle Up: a melee weapon\'s attacks as loose attacks to the end of the turn, for 1 / 3 / 5 Free actions; Hammer It Out - the scene, for a Reckless Abandon use', async () => {
    const economy = await import('../mechanics/actions/action-economy.mjs');
    economy.spend.mockClear();
    CATALOG.push({ uuid: C15('x', 'swingfx'), name: 'Swing', type: 'weaponEffect', system: { classification: { style: 'melee' } } });
    CATALOG.push({ uuid: C15('x', 'axe'), name: 'Axe', type: 'weapon', system: { availability: 'limited', items: { a: { type: 'weaponEffect', uuid: C15('x', 'swingfx'), classification: { style: 'melee' } } } } });
    CATALOG.push({ uuid: C15('x', 'gun'), name: 'Gun', type: 'weapon', system: { availability: 'standard', items: { a: { type: 'weaponEffect', uuid: C15('x', 'shotfx'), classification: { style: 'projectile' } } } } });
    const perk = packItem('knuckleUp');
    const actor = makeActor([perk]);
    expect(available(perk)).toBe(false);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 1, combatants: [], turns: [] };
    picks = ['Axe'];
    await use(perk);
    expect(offered[0]).toEqual(['Axe']);
    expect(economy.spend).toHaveBeenCalledTimes(3);
    const swing = actor.items.contents.find(item => item.name == 'Swing (Knuckle Up)');
    expect(swing.flags.essence20).toMatchObject({ parentId: null, temporary: { kind: 'turn', source: 'Knuckle Up', combatId: 'c1', round: 2, turn: 1 } });

    const hammer = packItem('knuckleUp');
    const reckless = makeItem({ name: 'Reckless Abandon', type: 'rolePoints', system: { resource: { value: 1, max: 3 } } });
    const brawler = makeActor([hammer, sourced('umLteVFW35otffjg', { name: 'Hammer It Out' }), reckless]);
    picks = ['Axe'];
    chooses = ['Until the end of the scene (spends a Reckless Abandon use)'];
    await use(hammer);
    expect(reckless.system.resource.value).toBe(0);
    expect(brawler.items.contents.find(item => item.name == 'Swing (Knuckle Up)').flags.essence20.temporary.kind).toBe('scene');
  });
});

/* -------------------------------------------- */
/*  Gear, healing, lending, one-shot defenses     */
/* -------------------------------------------- */

describe('poisons, heals, lending, picks', () => {
  test('Poisonous / Intoxicate: coating takes a Move / Free action (Intoxicate wins); Poison Tipped: a Fumble keeps the vial', async () => {
    const { coatingCost, resolveCoatingRoll } = await import('../items/gear/poison-coating.mjs');
    expect(coatingCost(makeActor())).toBe('standard');
    expect(coatingCost(makeActor([packItem('poisonous')]))).toBe('move');
    expect(coatingCost(makeActor([packItem('poisonous'), packItem('intoxicate')]))).toBe('free');
    for (const [items, used] of [[[], true], [[packItem('poisonTipped')], false]]) {
      const actor = makeActor(items);
      const poison = makeItem({ name: 'Venom', type: 'weapon', system: { isPoison: true, quantity: 2 } });
      const knife = makeItem({ name: 'Knife', type: 'weapon', system: {} });
      for (const one of [poison, knife]) {
        one.parent = actor;
        actor.items.contents.push(one);
      }

      await resolveCoatingRoll(actor, { poisonId: poison.id, weaponId: knife.id }, { success: false, isCrit: false, isFumble: true });
      expect([items.length, poison.system.quantity]).toEqual([items.length, used ? 1 : 2]);
    }
  });

  test('I\'ve Got You: a Use - Science against DIF 5 + 5 per Health; a success heals that much, +1 to a Defeated ally (who gets back up)', async () => {
    const perk = packItem('iveGotYou');
    makeActor([perk], { name: 'Medic' });
    const ally = makeActor([], { name: 'Ally', statuses: ['defeated'], system: { health: { max: 10, value: 0, bonus: 0 } } });
    expect(await use(perk)).toContain('NeedsTarget');
    global.game.user.targets = new Set([{ actor: ally }]);
    numbers = [3];
    rolls = [{ success: true }];
    await use(perk);
    expect(rollsMade).toEqual([{ skill: 'science', dif: 20 }]);
    expect(ally.system.health.value).toBe(4);
    expect(ally.statuses.has('defeated')).toBe(false);
    numbers = [2];
    rolls = [{ success: true }];
    await use(perk);
    expect(ally.system.health.value).toBe(6);
    numbers = [2];
    rolls = [{ success: false }];
    await use(perk);
    expect(ally.system.health.value).toBe(6);
  });

  test('Up And At \'Em: with I\'ve Got You, +1 more and an Edge banked for a Defeated ally; nothing without I\'ve Got You', async () => {
    const { restoreHealth } = await import('../mechanics/actions/heal-action.mjs');
    const medic = makeActor([packItem('iveGotYou', { source: 'Compendium.essence20.gi_joe_crb.Item.6wbY17kDGkxeGBPp' }), packItem('upAndAtEm')], { name: 'Medic' });
    const ally = makeActor([], { name: 'Ally', statuses: ['defeated'], system: { health: { max: 10, value: 0, bonus: 0 } } });
    await restoreHealth(medic, ally, 2);
    expect(ally.system.health.value).toBe(4);
    expect(bankedSources(ally, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ edge: true })]);
    const alone = makeActor([packItem('upAndAtEm')], { name: 'Alone' });
    const other = makeActor([], { name: 'Other', statuses: ['defeated'], system: { health: { max: 10, value: 0, bonus: 0 } } });
    await restoreHealth(alone, other, 2);
    expect(other.system.health.value).toBe(2);
    expect(bankedSources(other, { rolledSkill: 'athletics' }).sources).toEqual([]);
  });

  test('Support / Tech Support: lend an Upgrade to an adjacent (any, for Tech Support) ally until your next turn - Extended Support: a Move action for the scene', async () => {
    const economy = await import('../mechanics/actions/action-economy.mjs');
    economy.spend.mockClear();
    const perk = packItem('support');
    const scope = makeItem({ name: 'Scope', type: 'upgrade', system: { type: 'weapon' } });
    const plate = makeItem({ name: 'Plate', type: 'upgrade', system: { type: 'armor' } });
    for (const one of [scope, plate]) {
      one.toObject = () => JSON.parse(JSON.stringify({ name: one.name, type: one.type, system: one.system, flags: one.flags }));
    }

    const lender = makeActor([perk, scope, plate], { name: 'Tech' });
    const ally = makeActor([], { name: 'Ally' });
    const rifle = weapon(ally, { name: 'Rifle' });
    global.game.user.targets = new Set([{ actor: lender }]);
    await use(perk);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.O2NeedAlly');
    global.game.user.targets = new Set([{ actor: ally }]);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 1, combatants: [], turns: [] };
    picks = ['Scope', 'Rifle'];
    await use(perk);
    expect(economy.spend).toHaveBeenCalledWith(lender, 'free', expect.anything());
    const lent = ally.items.contents.find(item => item.name == 'Scope');
    expect(lent.flags.essence20).toMatchObject({ parentId: rifle.id, o2LentFrom: 'Tech', temporary: { kind: 'nextTurn', combatId: 'c1', round: 2, turn: 0 } });

    // Extended Support: the Move action, for the scene; an armor Upgrade counts as worn.
    const extended = makeActor([packItem('techSupport'), sourced('1DZCpqOqYqVjFkoG', { name: 'Extended Support' }), plate], { name: 'Pro' });
    const tech = extended.items.contents[0];
    economy.spend.mockClear();
    picks = ['Plate'];
    chooses = [lang('O2LendMove')];
    await use(tech);
    expect(economy.spend).toHaveBeenCalledWith(extended, 'move', expect.anything());
    expect(ally.items.contents.find(item => item.name == 'Plate').flags.essence20).toMatchObject({ alterationWorn: true, temporary: { kind: 'scene' } });
  });

  test('Welds, Rivets, and Ideas: a DIF 12 Technology success makes one Automatic / Standard / Limited gear or upgrade of your choice', async () => {
    CATALOG.push({ uuid: 'Compendium.essence20.x.Item.rope', name: 'Rope', type: 'gear', system: { availability: 'standard' } });
    CATALOG.push({ uuid: 'Compendium.essence20.x.Item.scope', name: 'Scope', type: 'upgrade', system: { availability: 'limited', type: 'weapon' } });
    CATALOG.push({ uuid: 'Compendium.essence20.x.Item.laser', name: 'Laser', type: 'upgrade', system: { availability: 'restricted' } });
    const perk = packItem('welds');
    const actor = makeActor([perk]);
    rolls = [{ success: false }];
    await use(perk);
    expect(offered).toEqual([]);
    rolls = [{ success: true }];
    picks = ['Scope'];
    await use(perk);
    expect(rollsMade.at(-1)).toEqual({ skill: 'technology', dif: 12 });
    expect(offered[0]).toEqual(['Rope', 'Scope']);
    expect(actor.items.contents.some(item => item.name == 'Scope' && item.type == 'upgrade')).toBe(true);
  });

  test('Why Do I Know That?: on being added, pick and grant a General Perk', async () => {
    const pickerMod = await import('../util/compendium-item-picker.mjs');
    const handler = await import('../sheet-handlers/perk-handler.mjs');
    pickerMod.findCompendiumItems.mockResolvedValue([{ uuid: 'Compendium.essence20.x.Item.luck', name: 'Lucky' }]);
    pickerMod.pickCompendiumItem.mockResolvedValue('Compendium.essence20.x.Item.luck');
    const perk = packItem('whyDoIKnowThat');
    const actor = makeActor([perk]);
    await fireItemAdded(actor, perk, { ask });
    expect(handler.grantPerkOutright).toHaveBeenCalledWith(actor, 'Compendium.essence20.x.Item.luck');
    handler.grantPerkOutright.mockClear();
    pickerMod.pickCompendiumItem.mockResolvedValue(null);
    await fireItemAdded(actor, perk, { ask });
    expect(handler.grantPerkOutright).not.toHaveBeenCalled();
  });

  test('Dig Deep (PR CRB): once per encounter each - ignore the next 1 damage with a Snag on the next roll, or heal 1d2', async () => {
    const { damageReduction } = await import('./plugins/combat/damage-reduction.mjs');
    const perk = packItem('digDeep');
    const actor = makeActor([perk], { system: { health: { max: 10, value: 5, bonus: 0 } } });
    chooses = [lang('DigDeepBenefitDamage')];
    await use(perk);
    expect(markOf(actor, 'digDeep')).toBe(true);
    expect(bankedSources(actor, { rolledSkill: 'athletics' }).sources).toEqual([expect.objectContaining({ snag: true })]);
    expect(await damageReduction(actor, 0, 'blunt')).toBe(0);
    expect(markOf(actor, 'digDeep')).toBe(true);
    expect(await damageReduction(actor, 3, 'blunt')).toBe(2);
    expect(markOf(actor, 'digDeep')).toBe(false);
    expect(await damageReduction(actor, 3, 'blunt')).toBe(3);

    // The damage half is spent this encounter: only the heal is left, taken without asking.
    chooses = [];
    await use(perk);
    expect(actor.system.health.value).toBeGreaterThanOrEqual(6);
    expect(actor.system.health.value).toBeLessThanOrEqual(7);
    expect(available(perk)).toBe(false);
  });

  test('Self-Preservation: Resistance to the Energy Affinity Element; 1 Energon - Immune to the next hit of it', async () => {
    const { damageReduction } = await import('./plugins/combat/damage-reduction.mjs');
    const perk = packItem('selfPreservation');
    const affinity = sourced('DgFY0ZmAtClAobiA', { name: 'Energy Affinity', system: { choice: 'fire' } });
    const actor = makeActor([perk, affinity]);
    ruleDerived(actor);
    expect(actor.system.resistances).toMatchObject({ fire: true });
    expect(await damageReduction(actor, 4, 'fire')).toBe(4);
    await use(perk);
    expect(actor.system.energon.normal.value).toBe(1);
    expect(await damageReduction(actor, 4, 'cold')).toBe(4);
    expect(await damageReduction(actor, 4, 'fire')).toBe(0);
    expect(await damageReduction(actor, 4, 'fire')).toBe(4);
    const without = makeActor([packItem('selfPreservation')]);
    ruleDerived(without);
    expect(without.system.resistances).toEqual({});
  });
});

/* -------------------------------------------- */
/*  Defenses, toggles and forms                  */
/* -------------------------------------------- */

describe('Scramble, Elemental Adaptation, Interspatial Pause, Shield Modulation, Mass Shift, Mode Attachment', () => {
  test('Scramble: a switch; while on, rolls against you target Evasion', async () => {
    const { ruleTargetedDefense } = await import('./plugins/combat/targeted-defense.mjs');
    const perk = packItem('scramble');
    const actor = makeActor([perk]);
    expect(ruleTargetedDefense(actor, makeActor(), null)).toBeNull();
    expect(await use(perk)).toContain('scrambles');
    expect(ruleTargetedDefense(actor, makeActor(), null)).toBe('evasion');
    expect(await use(perk)).toContain('stops scrambling');
    expect(ruleTargetedDefense(actor, makeActor(), null)).toBeNull();
  });

  test('Elemental Adaptation (Grid Power): Energy damage taken - 1 Personal Power for Resistance to it while Morphed, this scene; once per encounter, not when already resistant', async () => {
    const { sceneResistancesOf } = await import('../mechanics/world/scene-resistances.mjs');
    const power = packItem('gridElementalAdaptation');
    const actor = makeActor([power], { system: { isMorphed: true } });
    const take = (damageType, amount = 2) => fireTriggers(actor, 'takesDamage', { damage: { amount, damageType }, roll: { damageType, damageAmount: amount } });
    await take('blunt');
    expect(actor.system.powers.personal.value).toBe(3);
    actor.system.resistances.fire = true;
    await take('fire');
    expect(actor.system.powers.personal.value).toBe(3);
    delete actor.system.resistances.fire;
    await take('fire');
    expect(actor.system.powers.personal.value).toBe(2);
    expect(sceneResistancesOf(actor)).toEqual(['fire']);
    actor.system.isMorphed = false;
    expect(sceneResistancesOf(actor)).toEqual([]);
    await take('cold');
    expect(actor.system.powers.personal.value).toBe(2);
  });

  test('Interspatial Pause: 3 Personal Power - you and your adjacent allies are hidden and take no damage until your next turn (or a press, or the scene)', async () => {
    const tokenOf = actor => {
      const token = { document: { hidden: false, disposition: 1, update: jest.fn(async data => Object.assign(token.document, data)) } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    const perk = packItem('interspatialPause');
    const actor = makeActor([perk], { name: 'Pauser' });
    const ally = makeActor([], { name: 'Ally' });
    const mine = tokenOf(actor);
    const theirs = tokenOf(ally);
    global.game.actors = ALL.filter(doc => doc.documentName == 'Actor');
    const { setWorldLookups } = await import('./predicate.mjs');
    setWorldLookups({ alliesWithin: () => [ally] });
    allyTokens = [{ actor: ally }];
    await use(perk);
    expect(actor.system.powers.personal.value).toBe(0);
    expect([mine.document.hidden, theirs.document.hidden]).toEqual([true, true]);
    expect([ruleDamageTaken(actor, 5, 'fire'), ruleDamageTaken(ally, 5, 'fire'), ruleDamageTaken(makeActor(), 5, 'fire')]).toEqual([0, 0, 5]);
    expect(available(perk)).toBe(true);
    await fireTriggers(actor, 'turnStart');
    expect([mine.document.hidden, theirs.document.hidden]).toEqual([false, false]);
    expect([ruleDamageTaken(actor, 5, 'fire'), ruleDamageTaken(ally, 5, 'fire')]).toEqual([5, 5]);
    expect(available(perk)).toBe(false);
    setWorldLookups({ alliesWithin: null });
  });

  test('Shield Modulation: activating the Personal Shield asks for a damage type (cancelled - not activated); attacks of that type against you, and allies within 10 ft with Shield Upgrade, get a Snag', async () => {
    const { rolePointsActivating } = await import('./plugins/effects/state-changes.mjs');
    const { incomingAuraSources } = await import('./plugins/combat/targeted-defense.mjs');
    registerCheck('personalShield', actor => !!actor?.flags?.essence20?.shieldUp);
    global.CONFIG.E20.damageTypes = { fire: 'E20.DamageFire', cold: 'E20.DamageCold' };
    const perk = packItem('shieldModulation');
    const vanguard = makeActor([perk], { name: 'Vanguard', flags: { shieldUp: true } });
    const shield = makeItem({ name: 'Personal Shield', type: 'rolePoints', flags: { core: { sourceId: 'Compendium.essence20.gi_joe_crb.Item.84JYgd6kZgY41wge' } } });
    const other = makeItem({ name: 'Cheer', type: 'rolePoints' });
    picks = [];
    expect(await rolePointsActivating(vanguard, shield)).toBe(false);
    expect(await rolePointsActivating(vanguard, other)).toBe(true);
    picks = ['fire'];
    expect(await rolePointsActivating(vanguard, shield)).toBe(true);
    const attacker = makeActor([], { name: 'Foe' });
    const torch = effect(attacker, { damageType: 'fire' });
    const knife = effect(attacker, { damageType: 'sharp' });
    const snag = (target, item) => ruleRollSources(attacker, target, { item, isAttack: true }).sources.filter(s => /Shield Modulation/.test(s.label));
    expect(snag(vanguard, torch)).toEqual([expect.objectContaining({ snag: true })]);
    expect(snag(vanguard, knife)).toEqual([]);
    vanguard.flags.essence20.shieldUp = false;
    expect(snag(vanguard, torch)).toEqual([]);
    vanguard.flags.essence20.shieldUp = true;

    // An ally within 10 ft - only once the Vanguard has Shield Upgrade.
    const ally = makeActor([], { name: 'Ally' });
    const at = (actor, x) => {
      const token = { actor, center: { x, y: 0 }, document: { disposition: 1 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    global.canvas = { tokens: { placeables: [at(vanguard, 0), at(ally, 10)] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    expect(incomingAuraSources(attacker, ally, { item: torch }).sources).toEqual([]);
    vanguard.items.contents.push(Object.assign(sourced('ep0OFsU1QIuRpHeR', { name: 'Shield Upgrade' }), { parent: vanguard }));
    rebuildIndex(vanguard);
    expect(incomingAuraSources(attacker, ally, { item: torch }).sources).toEqual([expect.objectContaining({ snag: true, label: expect.stringContaining('Shield Modulation') })]);
    expect(incomingAuraSources(attacker, ally, { item: knife }).sources).toEqual([]);
    global.canvas.tokens.placeables[1].center.x = 20;
    expect(incomingAuraSources(attacker, ally, { item: torch }).sources).toEqual([]);
  });

  test('Mass Shift: once per scene - +1 to a Defense, ↑1 on a Skill, Melee Reach x2 for the scene or 1 temporary Health; massShiftUsed Triggers hear it', async () => {
    const perk = packItem('massShift');
    const heard = makeItem({ name: 'Listener', type: 'perk', system: { rules: [{ type: 'Trigger', event: 'massShiftUsed', steps: [{ do: 'updateActor', add: { 'flags.essence20.heard': 1 } }] }] } });
    const actor = makeActor([perk, heard], { system: { skills: { athletics: { shift: 'd6' }, might: { shift: 'd4' } } } });
    chooses = [lang('MassShiftBenefitDefense')];
    picks = ['evasion'];
    await use(perk);
    expect(actor.flags.essence20.heard).toBe(1);
    expect(available(perk)).toBe(false);
    const bank = await import('./bank.mjs');
    expect(bank.bankedEntries(actor).map(entry => [entry.defense, entry.defenseBonus])).toEqual([['evasion', 1]]);

    const second = makeActor([packItem('massShift')], { system: { skills: { athletics: { shift: 'd6' }, might: { shift: 'd4' } } } });
    const sword = effect(second, { totalReach: 5 });
    chooses = [lang('MassShiftBenefitReach')];
    await use(second.items.contents[0]);
    ruleDerived(second);
    expect(sword.system.totalReach).toBe(10);

    const third = makeActor([packItem('massShift')]);
    chooses = [lang('MassShiftBenefitTempHealth')];
    await use(third.items.contents[0]);
    expect(third.system.health.bonus).toBe(1);
  });

  test('Mode Attachment: the Use records the mode; changing into it asks for Technology DIF 10 + half your level', async () => {
    const { fireTransforming } = await import('./plugins/effects/state-changes.mjs');
    const hangUp = packItem('modeAttachment');
    const jet = makeItem({ name: 'Jet', type: 'altMode' });
    const actor = makeActor([hangUp, jet], { system: { level: 5 } });
    chooses = ['An Alt Mode'];
    picks = ['Jet'];
    await use(hangUp);
    expect(hangUp.system.choice).toBe(jet.id);
    await fireTransforming(actor, 'botMode');
    expect(rollsMade).toEqual([]);
    await fireTransforming(actor, jet.id);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 13 }]);
    chooses = [lang('ModeBotMode')];
    await use(hangUp);
    expect(hangUp.system.choice).toBe('botMode');
    await fireTransforming(actor, 'botMode');
    expect(rollsMade).toHaveLength(2);
  });
});

/* -------------------------------------------- */
/*  Damage about to land                         */
/* -------------------------------------------- */

describe('taking the hit: applyingDamage / damageLanding', () => {
  const yes = jest.fn(async () => true);
  const no = jest.fn(async () => false);
  beforeEach(() => {
    yes.mockClear();
    no.mockClear();
  });
  const place = (...pairs) => {
    allyTokens = pairs.map(([actor, at]) => ({ actor, at }));
  };

  test('Interpose (both printings): an adjacent ally holding it is offered the hit - accepted, it lands on them; declined or too far, it stays', async () => {
    const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
    for (const key of ['interpose', 'interposeSots']) {
      const target = makeActor([], { name: 'Hurt' });
      const protector = makeActor([packItem(key)], { name: 'Guard' });
      place([target, 0], [protector, 5]);
      expect(await applyingDamage(target, 4, { attacker: makeActor(), ask: yes })).toEqual({ target: protector, damage: 4, dropSecondary: false });
      expect(yes).toHaveBeenCalledWith('E20.DamageRedirectConfirmTitle', 'E20.DamageRedirectConfirmContent');
      expect((await applyingDamage(target, 4, { ask: no })).target).toBe(target);
      place([target, 0], [protector, 10]);
      yes.mockClear();
      expect((await applyingDamage(target, 4, { ask: yes })).target).toBe(target);
      expect(yes).not.toHaveBeenCalled();
      expect((await applyingDamage(target, 4, { ask: yes, redirect: false })).target).toBe(target);
    }
  });

  test('only the first protector is offered: Interpose, Body Shield, Heroic Sacrifice, Golden Guardian, Stand By Me', async () => {
    const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
    const target = makeActor([], { name: 'Hurt' });
    const golden = makeActor([packItem('goldenGuardian')], { name: 'Gold' });
    const standBy = makeActor([packItem('standByMe')], { name: 'Friend' });
    const interposer = makeActor([packItem('interpose')], { name: 'Guard' });
    place([target, 0], [golden, 5], [standBy, 5], [interposer, 5]);
    no.mockClear();
    expect((await applyingDamage(target, 3, { ask: no })).target).toBe(target);
    expect(no).toHaveBeenCalledTimes(1);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(interposer);
    place([target, 0], [standBy, 5], [golden, 5]);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(golden);
    place([target, 0], [standBy, 5]);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(standBy);
  });

  test('Body Shield / Heroic Sacrifice: once per turn; Heroic Sacrifice reaches as far as a Sprint (twice its Ground Movement)', async () => {
    const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    const target = makeActor([], { name: 'Hurt' });
    const shield = makeActor([packItem('bodyShield')], { name: 'Shield' });
    place([target, 0], [shield, 5]);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(shield);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(target);
    global.game.combat.turn = 1;
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(shield);

    const hero = makeActor([packItem('heroicSacrifice')], { name: 'Hero', system: { movement: { ground: { total: 30 } } } });
    place([target, 0], [hero, 60]);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(hero);
    global.game.combat.turn = 2;
    place([target, 0], [hero, 61]);
    expect((await applyingDamage(target, 3, { ask: yes })).target).toBe(target);
  });

  test('Golden Guardian: 1 Personal Power; with Counterstrike the attacker becomes the target', async () => {
    const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
    const target = makeActor([], { name: 'Hurt' });
    const golden = makeActor([packItem('goldenGuardian'), sourced('8mRJPvxLFVcf0egf', { name: 'Counterstrike' })], { name: 'Gold' });
    const attacker = makeActor([], { name: 'Foe' });
    attacker.getActiveTokens = () => [{ id: 'foeToken' }];
    const setTargets = jest.fn();
    global.canvas = { tokens: { setTargets, placeables: [] } };
    place([target, 0], [golden, 5]);
    expect((await applyingDamage(target, 3, { attacker, ask: yes })).target).toBe(golden);
    expect(golden.system.powers.personal.value).toBe(2);
    expect(setTargets).toHaveBeenCalledWith(['foeToken']);
    golden.system.powers.personal.value = 0;
    expect((await applyingDamage(target, 3, { attacker, ask: yes })).target).toBe(target);
  });

  test('Stand By Me: a Friendship Point to take it; +1 to every Defense of an adjacent ally (once however many hold it)', async () => {
    const holder = makeActor([packItem('standByMe')], { name: 'Friend' });
    const ally = makeActor([], { name: 'Ally' });
    const other = makeActor([packItem('standByMe')], { name: 'Other' });
    const tokenAt = (actor, x) => {
      const token = { actor, center: { x, y: 0 }, document: { disposition: 1 } };
      actor.getActiveTokens = () => [token];
      return token;
    };

    global.canvas = { tokens: { placeables: [tokenAt(holder, 0), tokenAt(ally, 5), tokenAt(other, 5)] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
    place([holder, 0], [ally, 5], [other, 5]);
    const { ruleDefenseAdjust } = await import('./adapter.mjs');
    const foe = makeActor([], { name: 'Foe' });
    expect(ruleDefenseAdjust(foe, ally, 'evasion', { difficulty: 12 })).toBe(1);
    place([holder, 0], [ally, 20], [other, 40]);
    ally.getActiveTokens()[0].center.x = 20;
    other.getActiveTokens()[0].center.x = 40;

    expect(ruleDefenseAdjust(foe, ally, 'evasion', { difficulty: 12 })).toBe(0);
  });

  test('Fe-BURN!: while Morphed with Terror, the one hit may spend it all - the hit halves (down) and the rest burns an adjacent enemy; it un-Morphs', async () => {
    const { applyingDamage } = await import('./plugins/combat/applying-damage.mjs');
    const handler = await import('../sheet-handlers/power-ranger-handler.mjs');
    handler.onMorph.mockClear();
    const terror = makeItem({ name: 'Terror', type: 'rolePoints', system: { resource: { value: 2, max: 5 } } });
    const ranger = makeActor([packItem('feBurn'), sourced('yBBB0Mi6fr84YcSd', { name: 'Terror' }), terror], { name: 'Ranger', system: { isMorphed: true } });
    ranger._getBaseRolePoints = () => terror;
    const enemy = makeActor([], { name: 'Enemy' });
    enemyTokens = [{ actor: enemy }];
    const asked = jest.fn(async () => true);
    expect(await applyingDamage(ranger, 5, { ask: asked, redirect: false })).toEqual({ target: ranger, damage: 2, dropSecondary: false });
    expect(asked.mock.calls[0][1]).toContain('2 accrued Terror');
    expect(terror.system.resource.value).toBe(0);
    expect(dealt).toEqual([{ name: 'Enemy', amount: 3, type: 'element' }]);
    expect(handler.onMorph).toHaveBeenCalledWith(ranger);

    // No Terror left, not Morphed, or declined: the damage stands.
    expect((await applyingDamage(ranger, 5, { ask: asked, redirect: false })).damage).toBe(5);
    terror.system.resource.value = 2;
    expect((await applyingDamage(ranger, 5, { ask: no, redirect: false })).damage).toBe(5);
    ranger.system.isMorphed = false;
    expect((await applyingDamage(ranger, 5, { ask: asked, redirect: false })).damage).toBe(5);
  });

  test('Cyborg: on the GM\'s client, damage about to land may be taken as Essence damage instead; no Health back while an Essence is damaged', async () => {
    const { damageLanding } = await import('./plugins/combat/applying-damage.mjs');
    const { checkActorUpdate } = await import('./plugins/effects/veto.mjs');
    global.CONFIG.E20.essences = { strength: 'E20.EssenceStrength', speed: 'E20.EssenceSpeed', smarts: 'E20.EssenceSmarts', social: 'E20.EssenceSocial' };
    const cyborg = makeActor([packItem('cyborg')], { name: 'Cyborg', system: { essences: { strength: { value: 3, max: 3 }, speed: { value: 0, max: 2 }, smarts: { value: 2, max: 2 }, social: { value: 1, max: 1 } }, health: { max: 10, value: 4, bonus: 0 } } });
    picks = ['strength'];
    const asked = jest.fn(async () => true);
    expect(await damageLanding(cyborg, 5, 'blunt', { ask: asked })).toBe(2);
    expect(offered[0]).toEqual(['E20.EssenceStrength', 'E20.EssenceSmarts', 'E20.EssenceSocial']);
    expect(cyborg.system.essences.strength.value).toBe(0);
    expect(await damageLanding(cyborg, 5, 'blunt', { ask: no })).toBe(5);
    global.game.user.isGM = false;
    expect(await damageLanding(cyborg, 5, 'blunt', { ask: asked })).toBe(5);
    global.game.user.isGM = true;

    const changes = { system: { health: { value: 8 } } };
    checkActorUpdate(cyborg, changes);
    expect(changes.system.health.value).toBe(4);
    cyborg.system.essences.strength.value = 3;
    cyborg.system.essences.speed.value = 2;
    const later = { system: { health: { value: 8 } } };
    checkActorUpdate(cyborg, later);
    expect(later.system.health.value).toBe(8);
  });
});

/* -------------------------------------------- */
/*  Alteration Perks: pickGrant via the drop      */
/* -------------------------------------------- */

describe('Cybernetic Part and its siblings: an Alteration of the tier through the Alteration drop handler', () => {
  const TIERS = {
    cyberneticPart: ['standard', 'cybernetic'], enhancedPart: ['limited', 'cybernetic'], optimizedPart: ['restricted', 'cybernetic'],
    engraftedMutation: ['standard', 'genetic'], evolvingMutation: ['limited', 'genetic'], outrightMutation: ['restricted', 'genetic'],
  };
  const catalog = () => {
    for (const [name, availability] of [['Claws', 'standard'], ['Gills', 'standard'], ['Wings', 'limited'], ['Armor Skin', 'restricted'], ['Eyes', 'restricted']]) {
      CATALOG.push({ uuid: C('cobra_codex', `alt${name.replace(' ', '')}`), name, type: 'alteration', system: { availability } });
    }
  };

  test('on taking it: pick one of its tier not already held (dragged in or by originalId); it lands flagged, the Use goes', async () => {
    for (const [key, [tier, form]] of Object.entries(TIERS)) {
      CATALOG.length = 0;
      catalog();
      offered = [];
      const held = makeItem({ name: 'Old Eyes', type: 'alteration', system: { originalId: 'altEyes' } });
      const perk = packItem(key);
      const actor = makeActor([held, perk]);
      const want = CATALOG.filter(entry => entry.system.availability == tier && entry.name != 'Eyes');
      picks = [want[0].name];
      await fireItemAdded(actor, perk);
      expect([key, offered[0]]).toEqual([key, want.map(entry => entry.name)]);
      const made = actor.items.contents.find(item => item.type == 'alteration' && item.name == want[0].name);
      expect([key, made?.flags.essence20[`${form}Alteration`], made?.flags.essence20.grantedBy, made?.flags.core.sourceId])
        .toEqual([key, true, perk.id, want[0].uuid]);
      expect([key, available(perk)]).toEqual([key, false]);
    }
  });

  test('a closed drop dialog makes nothing and leaves the Use; the Use picks later', async () => {
    catalog();
    const perk = packItem('engraftedMutation');
    const actor = makeActor([perk]);
    dropRefused = true;
    picks = ['Claws'];
    await fireItemAdded(actor, perk);
    expect(actor.items.contents.filter(item => item.type == 'alteration')).toHaveLength(0);
    expect(available(perk)).toBe(true);
    dropRefused = false;
    picks = ['Gills'];
    await use(perk);
    expect(actor.items.contents.find(item => item.type == 'alteration')?.name).toBe('Gills');
    expect(available(perk)).toBe(false);
  });

  // Book check (effects): Beast Mode gives "the benefits of" the Mutation Perk for the scene, and that benefit is the
  // Alteration - so its scene copy picks one too, lasting the scene (no Use button left on the copy).
  test('Beast Mode\'s scene copy picks an Alteration for the scene; an already-granted (old flag) copy hands out nothing', async () => {
    catalog();
    const beast = packItem('engraftedMutation', { flags: { beastMode: true } });
    const done = packItem('cyberneticPart', { flags: { granted: true } });
    const actor = makeActor([beast, done]);
    picks = ['Claws', 'Claws'];
    await fireItemAdded(actor, beast);
    await fireItemAdded(actor, done);
    expect(offered).toEqual([['Claws', 'Gills']]);
    const made = actor.items.contents.find(item => item.type == 'alteration');
    expect([made?.name, made?.flags.essence20.grantedBy, made?.flags.essence20.rulesExpiry?.until]).toEqual(['Claws', beast.id, 'scene']);
    expect(available(beast)).toBe(false);
    expect(available(done)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Deflecting Weapons: a shield linked to a host */
/* -------------------------------------------- */

describe('Limited / Standard Deflecting Weapon: the chosen shield, linked to the weapon', () => {
  const setup = (key, equipped = true) => {
    CATALOG.push({ uuid: C('cobra_codex', 'buckler'), name: 'Buckler', type: 'shield', system: { availability: 'limited' } });
    CATALOG.push({ uuid: C('cobra_codex', 'riot'), name: 'Riot Shield', type: 'shield', system: { availability: 'standard' } });
    const gun = makeItem({ name: 'Rifle', type: 'weapon', system: { equipped } });
    const upgrade = packItem(key, { flags: { parentId: gun.id } });
    const actor = makeActor([gun, upgrade]);
    return { actor, gun, upgrade };
  };

  const shieldOf = actor => actor.items.contents.find(item => item.type == 'shield');

  test('attached: pick a shield of the tier; it is linked to the weapon, equipped as the weapon is, lowered; the Use goes', async () => {
    for (const [key, name] of [['limitedDeflecting', 'Buckler'], ['standardDeflecting', 'Riot Shield']]) {
      offered = [];
      CATALOG.length = 0;
      const { actor, gun, upgrade } = setup(key, key == 'limitedDeflecting');
      picks = [name];
      await fireItemAdded(actor, upgrade);
      expect(offered).toEqual([[name]]);
      const shield = shieldOf(actor);
      expect([shield.flags.essence20.linkedHost, shield.flags.essence20.grantedBy, shield.system.equipped, shield.system.active])
        .toEqual([gun.id, upgrade.id, key == 'limitedDeflecting', false]);
      expect(shield.name).toBe('E20.O1DeflectingName');
      expect(available(upgrade)).toBe(false);
    }
  });

  test('not attached to a weapon: nothing asked and no Use; a cancelled pick leaves the Use', async () => {
    CATALOG.push({ uuid: C('cobra_codex', 'buckler'), name: 'Buckler', type: 'shield', system: { availability: 'limited' } });
    const loose = packItem('limitedDeflecting');
    const actor = makeActor([loose]);
    await fireItemAdded(actor, loose);
    expect(offered).toEqual([]);
    expect(available(loose)).toBe(false);
    const { upgrade } = setup('limitedDeflecting');
    picks = [];
    await fireItemAdded(upgrade.parent, upgrade);
    expect(available(upgrade)).toBe(true);
  });

  test('the shield follows the weapon: unequipped (lowered, Defense bonus cleared), equipped again; deleting the weapon takes it', async () => {
    const { syncLinked, removeLinked, linkedWarning } = await import('./plugins/effects/linked-host.mjs');
    global.CONFIG.E20.defenses = { toughness: 'T', evasion: 'E' };
    const { actor, gun, upgrade } = setup('limitedDeflecting');
    picks = ['Buckler'];
    await fireItemAdded(actor, upgrade);
    const shield = shieldOf(actor);
    shield.system.active = true;
    const attack = makeItem({ name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: gun.id } } });
    attack.parent = actor;
    expect(linkedWarning(actor, attack)).toBe('E20.O1DeflectingRaised');
    expect(linkedWarning(actor, gun)).toBe('E20.O1DeflectingRaised');

    gun.system.equipped = false;
    await syncLinked(gun, { system: { equipped: false } }, {}, 'u1');
    expect([shield.system.equipped, shield.system.active]).toEqual([false, false]);
    expect(actor.update).toHaveBeenCalledWith({ 'system.defenses.toughness.shield': 0, 'system.defenses.evasion.shield': 0 });
    expect(linkedWarning(actor, attack)).toBeNull();
    await syncLinked(gun, { system: { equipped: true } }, {}, 'u1');
    expect(shield.system.equipped).toBe(true);
    await syncLinked(gun, { system: { equipped: false } }, {}, 'someone else');
    expect(shield.system.equipped).toBe(true);

    await removeLinked(gun, {}, 'u1');
    expect(shieldOf(actor)).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  The Disruptor Focus: item-carried marks       */
/* -------------------------------------------- */

describe('Technical Glitch / Some Assembly Required / Complete System Failure: a disrupted item, its Reboot and Repair', () => {
  const MARK = item => item.flags.essence20.ruleItemMarks?.disrupted ?? null;
  const setup = (perks = []) => {
    global.CONFIG.E20.availabilityDifficulties = { standard: 0, limited: 10, restricted: 15 };
    const radio = makeItem({ name: 'Radio', type: 'gear', system: { traits: ['computerized'], availability: 'limited', equipped: true } });
    const comm = makeItem({ name: 'Comm', type: 'gear', system: { traits: ['computerized'], availability: 'standard', equipped: true } });
    const club = makeItem({ name: 'Club', type: 'weapon', system: { traits: [], availability: 'standard', equipped: true } });
    const owner = makeActor([radio, comm, club], { name: 'Owner' });
    const glitch = packItem('technicalGlitch');
    const assembly = packItem('someAssemblyRequired');
    const disruptor = makeActor([glitch, assembly, ...perks], { name: 'Disruptor' });
    global.game.user.targets = new Set([{ actor: owner }]);
    return { radio, comm, club, owner, glitch, assembly, disruptor };
  };

  test('Technical Glitch: a computerized item of the target, Technology vs its Availability DIF; it is unequipped until rebooted (a Move action)', async () => {
    const { radio, club, owner, glitch, disruptor } = setup();
    picks = ['Radio'];
    await use(glitch);
    expect(offered[0]).toEqual(['Radio', 'Comm']);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 10 }]);
    expect(pay).toHaveBeenCalled();
    expect(MARK(radio).effects).toEqual({ inoperable: true });
    expect(radio.system.equipped).toBe(false);
    expect(club.system.equipped).toBe(true);
    const [reboot] = buttons();
    expect(reboot.who).toBe('targets');
    expect(buttons()).toHaveLength(1);

    // Its attack warns; it is no longer offered.
    const { inoperableWarning } = await import('./plugins/gear/item-disruption.mjs');
    const shot = makeItem({ name: 'Zap', type: 'weaponEffect', flags: { essence20: { parentId: radio.id } } });
    shot.parent = owner;
    expect(inoperableWarning(owner, shot)).toBe('E20.Gij3StillInoperable');

    await press(reboot, disruptor, glitch);
    expect(MARK(radio)).toBeNull();
    expect(radio.system.equipped).toBe(true);
    expect(inoperableWarning(owner, shot)).toBeNull();
    // A second press finds nothing to reboot.
    expect(await press(reboot, disruptor, glitch)).toBe(false);
  });

  test('a Standard item is disrupted without a roll; a failed roll disrupts nothing', async () => {
    const { radio, comm, glitch } = setup();
    picks = ['Comm'];
    await use(glitch);
    expect(rollsMade).toEqual([]);
    expect(MARK(comm)).not.toBeNull();
    picks = ['Radio'];
    rolls = [{ success: false }];
    ChatMessage.create.mockClear();
    await use(glitch);
    expect(MARK(radio)).toBeNull();
    expect(buttons()).toEqual([]);
  });

  test('Complete System Failure: Snag and ↓2 on rolls with it (and tests to repair it) until the disruptor presses Repair; a Reboot keeps it', async () => {
    const { radio, owner, glitch, disruptor } = setup([sourced('eMliZALtmapa7zoo', { name: 'Complete System Failure' })]);
    picks = ['Radio'];
    await use(glitch);
    expect(MARK(radio).effects).toEqual({ inoperable: true, csf: true, rollSnag: true, rollShiftDown: 2, rollLabel: 'Complete System Failure' });
    const [reboot, repair] = buttons();
    expect(repair.who).toBe('owner');
    const { itemMarkSources } = await import('./plugins/gear/item-disruption.mjs');
    const shot = makeItem({ name: 'Zap', type: 'weaponEffect', flags: { essence20: { parentId: radio.id } } });
    shot.parent = owner;
    expect(itemMarkSources(owner, null, { item: shot }).sources).toEqual([expect.objectContaining({ label: 'Complete System Failure (Radio)', snag: true, shiftDown: 2 })]);
    expect(itemMarkSources(owner, null, { dataset: { markedItemUuid: radio.uuid } }).sources).toHaveLength(1);

    await press(reboot, disruptor, glitch);
    expect(radio.system.equipped).toBe(true);
    expect(MARK(radio).effects.inoperable).toBe(false);
    expect(itemMarkSources(owner, null, { item: radio }).sources).toHaveLength(1);

    await press(repair, disruptor, glitch);
    expect(MARK(radio)).toBeNull();
    expect(itemMarkSources(owner, null, { item: radio }).sources).toEqual([]);
  });

  test('Some Assembly Required: out of combat, any equipment; the roll total is the reboot DIF, rolled by the owner with the item named', async () => {
    const { club, owner, assembly, disruptor } = setup();
    disruptor._dice = { rollSkill: jest.fn(async () => ({ total: 17, outcomes: [{ roll: { total: 17 } }] })) };
    picks = ['Club'];
    await use(assembly);
    expect(offered[0]).toEqual(['Radio', 'Comm', 'Club']);
    expect(disruptor._dice.rollSkill.mock.calls[0][0]).toMatchObject({ skill: 'technology', shiftUp: 0, shiftDown: 0 });
    expect(MARK(club).effects).toEqual({ inoperable: true });
    expect(club.system.equipped).toBe(false);
    const [reboot] = buttons();
    rolls = [{ success: false }];
    await press(reboot, disruptor, assembly);
    expect(grants.rollTest.mock.calls.at(-1)[0]).toBe(owner);
    expect(grants.rollTest.mock.calls.at(-1)[2]).toBe(17);
    expect(grants.rollTest.mock.calls.at(-1)[3]).toMatchObject({ markedItemUuid: club.uuid });
    expect(club.system.equipped).toBe(false);

    global.game.combat = { id: 'c', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    expect(available(assembly)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Shape-shifting: one shape, picks from items   */
/* -------------------------------------------- */

describe('Shape-Shift, Face-Shift, Master Morph, Size-Shift: one Change Shape dialog the Perks add picks to', () => {
  const answer = value => {
    const seen = [];
    global.foundry.applications.api.DialogV2.wait = jest.fn(async config => {
      seen.push(config.content);
      return typeof value == 'function' ? value(config) : value;
    });
    return seen;
  };

  const setup = keys => {
    global.CONFIG.E20.actorSizes = { small: 'S', common: 'C', large: 'L', huge: 'H' };
    global.CONFIG.E20.skills = { persuasion: 'E20.SkillPersuasion', alertness: 'E20.SkillAlertness' };
    const items = keys.map(key => packItem(key));
    const actor = makeActor(items, { system: { size: 'common' } });
    return { actor, items };
  };

  test('the dialog offers what the Perks give; the picks are kept for the scene and give ↑1 / ↑2 on those Skills', async () => {
    const { actor, items } = setup(['shapeShift', 'faceShift', 'masterMorph', 'sizeShift']);
    const seen = answer({ faceSkill: 'persuasion', morphSkill: 'alertness', size: 'large' });
    await use(items[0]);
    expect(seen[0]).toContain('name="faceSkill"');
    expect(seen[0]).toContain('name="morphSkill"');
    expect(seen[0]).toContain('value="large"');
    expect(seen[0]).not.toContain('value="huge"');
    expect(actor.flags.essence20.mlpShape).toEqual({ faceSkill: 'persuasion', morphSkill: 'alertness', originalSize: 'common', scene: 1 });
    expect(actor.system.size).toBe('large');

    const shifts = rolledSkill => ruleRollSources(actor, null, { rolledSkill }).sources.map(source => [source.label, source.upshift ?? source.shiftUp]);
    expect(shifts('persuasion')).toEqual([['Face-Shift', 1]]);
    expect(shifts('alertness')).toEqual([['Master Morph', 2]]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' }).map(entry => entry.label)).toEqual(['Passing as the individual (Face-Shift: Edge)']);

    // Pressed again (any of the four): back to normal.
    await use(items[2]);
    expect(actor.flags.essence20.mlpShape).toBeUndefined();
    expect(actor.system.size).toBe('common');
    expect(shifts('persuasion')).toEqual([]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' })).toEqual([]);
  });

  test('Shape-Shift alone: no picks; two Size-Shifts reach two sizes away; a closed dialog changes nothing', async () => {
    const { actor, items } = setup(['shapeShift']);
    const seen = answer({ size: null });
    await use(items[0]);
    expect(seen[0]).not.toContain('<select');
    expect(actor.flags.essence20.mlpShape).toEqual({ scene: 1 });

    const two = makeActor([packItem('sizeShift'), packItem('sizeShift')], { system: { size: 'small' } });
    const seenTwo = answer(null);
    await use(two.items.contents[0]);
    expect(seenTwo[0]).toContain('value="large"');
    expect(seenTwo[0]).not.toContain('value="huge"');
    expect(two.flags.essence20.mlpShape).toBeUndefined();
  });
});

/* -------------------------------------------- */
/*  Bring It All Down: a pick before the template */
/* -------------------------------------------- */

describe('Bring It All Down: an explosive attack asks for ↑2, double blast radius, +2 damage or Armor-Piercing', () => {
  test('each option; none, a closed dialog or a non-explosive attack changes nothing', async () => {
    const { ruleAttackChoice, NO_CHOICE } = await import('./plugins/combat/attack-choice.mjs');
    const actor = makeActor([packItem('bringItAllDown')]);
    const bomb = effect(actor, { style: 'explosive', skill: 'technology' });
    const wait = jest.fn();
    global.foundry.applications.api.DialogV2.wait = wait;
    const pick = async value => {
      wait.mockResolvedValueOnce(value);
      return ruleAttackChoice(actor, bomb);
    };

    expect(await pick('0')).toEqual({ ...NO_CHOICE, shiftUp: 2 });
    expect(await pick('1')).toEqual({ ...NO_CHOICE, radiusMultiplier: 2 });
    expect(await pick('2')).toEqual({ ...NO_CHOICE, damage: 2 });
    expect(await pick('3')).toEqual({ ...NO_CHOICE, armorPiercing: true });
    expect(await pick('none')).toEqual(NO_CHOICE);
    expect(await pick(null)).toEqual(NO_CHOICE);
    expect(wait.mock.calls[0][0].window.title).toBe('E20.BringItAllDownPickTitle');
    expect(wait.mock.calls[0][0].content).toContain('E20.BringItAllDownOptionRadius');

    wait.mockClear();
    expect(await ruleAttackChoice(actor, effect(actor, { style: 'ranged' }))).toEqual(NO_CHOICE);
    expect(await ruleAttackChoice(makeActor(), bomb)).toEqual(NO_CHOICE);
    expect(wait).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Multimorph: other Origins' Perks for a scene  */
/* -------------------------------------------- */

describe('Multimorph: two Origin Perks from two other MLP Origins (or one), for the scene; pressed again it changes back', () => {
  const origins = () => {
    const perk = (pack, id, name) => {
      const uuid = C(pack, id);
      CATALOG.push({ uuid, name, type: 'perk', system: {} });
      return { type: 'perk', uuid, name };
    };

    CATALOG.push({ uuid: C('mlp_crb', 'pegasus'), name: 'Pegasus', type: 'origin', system: { items: { a: perk('mlp_crb', 'flight', 'Flight'), b: perk('mlp_crb', 'weather', 'Weather Control') } } });
    CATALOG.push({ uuid: C('dark_skies_over_equestria', 'changeling'), name: 'Changeling', type: 'origin', system: { items: { a: perk('dark_skies_over_equestria', 'hive', 'Hive Mind') } } });
    CATALOG.push({ uuid: C('mlp_crb', 'unicorn'), name: 'Unicorn', type: 'origin', system: { items: { a: perk('mlp_crb', 'magic', 'Magic') } } });
    CATALOG.push({ uuid: C('gi_joe_crb', 'brawler'), name: 'Brawler', type: 'origin', system: { items: { a: perk('gi_joe_crb', 'punch', 'Punch') } } });
  };

  test('two: other MLP Origins only (not its own), the second from a different Origin; granted for the scene', async () => {
    origins();
    const item = packItem('multimorph');
    const actor = makeActor([item, makeItem({ name: 'Unicorn', type: 'origin' })]);
    chooses = ['Two Origin Perks from two different Origins'];
    picks = ['Pegasus: Flight', 'Changeling: Hive Mind'];
    await use(item);
    expect(offered[0]).toEqual(['Changeling: Hive Mind', 'Pegasus: Flight', 'Pegasus: Weather Control']);
    expect(offered[1]).toEqual(['Changeling: Hive Mind']);
    const gained = actor.items.contents.filter(one => one.flags.essence20.grantedBy == item.id);
    expect(gained.map(one => [one.name, one.flags.essence20.o1Multimorph, one.flags.essence20.rulesExpiry?.until])).toEqual([['Flight', true, 'scene'], ['Hive Mind', true, 'scene']]);

    // Pressed again: back to normal.
    expect(available(item)).toBe(true);
    await use(item);
    expect(actor.items.contents.filter(one => one.flags.essence20.grantedBy == item.id)).toEqual([]);
  });

  test('one: a single Perk; a cancelled pick gives nothing', async () => {
    origins();
    const item = packItem('multimorph');
    const actor = makeActor([item]);
    chooses = ["One other Origin's Perk, keep Natural Shape"];
    picks = ['Unicorn: Magic'];
    await use(item);
    expect(actor.items.contents.filter(one => one.flags.essence20.grantedBy == item.id).map(one => one.name)).toEqual(['Magic']);

    const other = packItem('multimorph');
    const second = makeActor([other]);
    chooses = ['Two Origin Perks from two different Origins'];
    picks = ['Pegasus: Flight', null];
    await use(other);
    expect(second.items.contents.filter(one => one.flags.essence20.grantedBy == other.id)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Patch Up: the flagged heal / repair test      */
/* -------------------------------------------- */

describe('Patch Up: 1 Energon, once per turn (any number with Intensive) - Science or Technology vs 5 + 5 per Health, a flagged Patch Up test', () => {
  test('spends the Energon and rolls the flagged test; once per combat turn; none without Energon', async () => {
    const item = packItem('patchUp');
    const medic = makeActor([item], { system: { energon: { normal: { value: 2, max: 5 } } } });
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    chooses = ['Technology (Repair a Cybertronian or vehicle)'];
    numbers = [2];
    await use(item);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 15 }]);
    expect(grants.rollTest.mock.calls.at(-1)[3]).toMatchObject({ isPatchUp: true, patchUpAmount: 2 });
    expect(medic.system.energon.normal.value).toBe(1);
    expect(available(item)).toBe(false);
    global.game.combat.turn = 1;
    expect(available(item)).toBe(true);
    medic.system.energon.normal.value = 0;
    expect(available(item)).toBe(false);
  });

  test('with Intensive: no per-turn cap', async () => {
    const item = packItem('patchUp');
    const medic = makeActor([item, sourced('lupxm8SNDLvbjoDt', { name: 'Intensive' })], { system: { energon: { normal: { value: 3, max: 5 } } } });
    global.game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [], turns: [] };
    for (const skill of ['Science (Heal an organic lifeform)', 'Science (Heal an organic lifeform)']) {
      chooses = [skill];
      numbers = [1];
      await use(item);
    }

    expect(rollsMade).toEqual([{ skill: 'science', dif: 10 }, { skill: 'science', dif: 10 }]);
    expect(available(item)).toBe(true);
    expect(medic.system.energon.normal.value).toBe(1);
  });
});

/* -------------------------------------------- */
/*  Defibrillator: six rounds, then 1 Health      */
/* -------------------------------------------- */

describe('Defibrillator: a Defeated target gets 1 Health - at once out of combat, after six rounds in one; used up', () => {
  const setup = (quantity = 1) => {
    const defib = packItem('defibrillator', { system: { quantity } });
    const medic = makeActor([defib], { name: 'Medic' });
    const hurt = makeActor([], { name: 'Hurt', statuses: ['defeated'], system: { health: { max: 10, value: 0, bonus: 0 } } });
    global.game.user.targets = new Set([{ actor: hurt }]);
    global.game.actors = [medic, hurt];
    return { defib, medic, hurt };
  };

  test('out of combat: at once, and it is used up; a target that is not Defeated is refused', async () => {
    const { defib, medic, hurt } = setup();
    await use(defib);
    expect(hurt.system.health.value).toBe(1);
    expect(hurt.statuses.has('defeated')).toBe(false);
    expect(medic.items.contents).not.toContain(defib);

    const again = setup(2);
    again.hurt.statuses.delete('defeated');
    await use(again.defib);
    expect(again.hurt.system.health.value).toBe(0);
    expect(again.defib.system.quantity).toBe(2);
  });

  test('in combat: a Standard action, then at the start of round +6 the target (still Defeated) gets 1 Health; one at a time', async () => {
    const { defib, medic, hurt } = setup(2);
    global.game.combat = { id: 'c1', started: true, round: 2, turn: 0, combatants: [], turns: [] };
    await use(defib);
    expect(pay).toHaveBeenCalledWith('standard');
    expect(hurt.system.health.value).toBe(0);
    expect(available(defib)).toBe(false);

    global.game.combat.round = 7;
    await fireTriggers(medic, 'roundStart');
    expect(hurt.system.health.value).toBe(0);
    global.game.combat.round = 8;
    await fireTriggers(medic, 'roundStart');
    expect(hurt.system.health.value).toBe(1);
    expect(defib.system.quantity).toBe(1);
    expect(available(defib)).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Shield Upgrade: a lent per-attack Defense     */
/* -------------------------------------------- */

describe('Shield Upgrade: an active Personal Shield lends its bonus to allies within 10 ft (the best one counts)', () => {
  const vanguard = ({ up = true, value = 3, covers = true, has = true } = {}) => {
    const actor = makeActor(has ? [packItem('shieldUpgrade')] : [], { name: 'Vanguard', flags: { shieldUp: up } });
    actor._getBaseRolePoints = () => ({ system: { isActive: up, bonus: { type: 'defenseBonus', value, defenseBonus: { toughness: covers, evasion: covers } } } });
    return actor;
  };

  const scene = (target, others) => {
    const token = (actor, x, disposition = 1) => {
      const one = { actor, center: { x, y: 0 }, document: { disposition } };
      actor.getActiveTokens = () => [one];
      return one;
    };

    global.canvas = { tokens: { placeables: [token(target, 0), ...others.map(([actor, x, side]) => token(actor, x, side))] }, grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) } };
  };

  test('in range, active, covering that Defense, an ally, holding the Perk; Toughness and Evasion only', async () => {
    const { ruleDefenseAura } = await import('./plugins/combat/defense-aura.mjs');
    registerCheck('personalShield', actor => !!actor?.flags?.essence20?.shieldUp);
    const ally = makeActor([], { name: 'Ally' });
    scene(ally, [[vanguard(), 5]]);
    expect(ruleDefenseAura(ally, 'toughness')).toBe(3);
    expect(ruleDefenseAura(ally, 'evasion')).toBe(3);
    expect(ruleDefenseAura(ally, 'willpower')).toBe(0);
    scene(ally, [[vanguard(), 11]]);
    expect(ruleDefenseAura(ally, 'toughness')).toBe(0);
    for (const holder of [vanguard({ up: false }), vanguard({ has: false }), vanguard({ covers: false })]) {
      scene(ally, [[holder, 5]]);
      expect(ruleDefenseAura(ally, 'toughness')).toBe(0);
    }

    scene(ally, [[vanguard(), 5, -1]]);
    expect(ruleDefenseAura(ally, 'toughness')).toBe(0);
    scene(ally, [[vanguard({ value: 2 }), 5], [vanguard({ value: 5 }), 10]]);
    expect(ruleDefenseAura(ally, 'toughness')).toBe(5);

    // Its own shield isn't lent to itself; no token, nothing.
    const self = vanguard();
    scene(self, []);
    expect(ruleDefenseAura(self, 'toughness')).toBe(0);
    expect(ruleDefenseAura(makeActor(), 'toughness')).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Imperial Machine Mantle                       */
/* -------------------------------------------- */

describe('Imperial Machine Mantle: +50% (rounded up) of the armor share to Toughness only, until a Critical Success lands', () => {
  const wearer = armorShare => makeActor([packItem('machineMantle')], { system: { defenses: {
    toughness: { total: 15, string: '15', armorShare }, evasion: { total: 11, string: '11', armorShare },
  } } });

  test('ceil(armorShare / 2) on Toughness, labelled; nothing on Evasion or with no armor', async () => {
    const actor = wearer(3);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(17);
    expect(actor.system.defenses.toughness.string).toBe('15 + 2 (Imperial Machine Mantle)');
    expect(actor.system.defenses.evasion.total).toBe(11);
    const bare = wearer(0);
    ruleDerived(bare);
    expect(bare.system.defenses.toughness).toMatchObject({ total: 15, string: '15' });
  });

  test('a Critical Success landing breaks it (flagged, so a GM can repair it); then it adds nothing', async () => {
    const { criticallyHit } = await import('./plugins/combat/critically-hit-event.mjs');
    const actor = wearer(6);
    const [mantle] = actor.items.contents;
    await criticallyHit(actor, makeActor());
    expect(mantle.flags.essence20.imperialMachineMantleBroken).toBe(true);
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(15);
    mantle.update.mockClear();
    await criticallyHit(actor);
    expect(mantle.update).not.toHaveBeenCalled();
  });
});
