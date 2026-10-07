import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, part "items1" (docs/rules-batches/slItems114.md): item code under module/items/ (attacks ... healing) moved
 * onto the items' own rules. Each item is loaded from its pack source and must do what the removed code (and its old
 * tests) did.
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
  getLedger: () => null,
  setNextTurn: jest.fn(),
}));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  antlers: 'dsoeitems/_source/Antlers_MIqTCcA1vXERwPYv.json',
  extendedAttack: 'tfcrbitems/_source/Extended_Attack_bpTOPVRx3hKkq4Yr.json',
  assaultClaw: 'eocitems/_source/Assault_Claw_VKaNv1Vf0O6ewkix.json',
  chargeItUp: 'jttitems/_source/Charge_It_Up__eDLYdEHBTU2S2qp0.json',
  createWeapon: 'qgtgitems/_source/Create_Weapon_Qb0LifFSyfOCFIVd.json',
  cripplingBlow: 'dditems/_source/Crippling_Blow_SKHtIija5VRPcuBu.json',
  deconstructionist: 'qgtgitems/_source/Deconstructionist_2qb5dV11qvWsN4xJ.json',
  favoriteWeapon: 'dditems/_source/Favorite_Weapon_emaXxo2XzoHMoNCe.json',
  flashy: 'tfcrbitems/_source/Flashy_l79g3PoYo7nyln4X.json',
  sneakAttack: 'fffav1items/_source/Sneak_Attack_FWN6697ESy9ua6VI.json',
  frenziedAttack: 'dditems/_source/Frenzied_Attack_74X6WTVVP1cfnOpI.json',
  ttcEnergy: 'atsitems/_source/Turbo_Thunder_Cannon_Energy_Attack_Wl7L2wcydXAw9Xei.json',
  ttcAlternate: 'prcrbitems/_source/Turbo_Thunder_Cannon_Alternate_Effect_GkobUXUpyU8l6gKw.json',
  tlsEnergy: 'atsitems/_source/Turbo_Lightning_Sword_Energy_Attack_3VBxXY5kXow9UGgX.json',
  tlsAlternate: 'prcrbitems/_source/Turbo_Lightning_Sword_Alternate_Effect_A2T4cCya4l1rlihY.json',
  wingBlast: 'atsitems/_source/Wing_Missile_Salvo_Effect_Z6cpZMj1nKTquCLF.json',
  wingCone: 'atsitems/_source/Wing_Missile_Salvo_Alternate_Effect_FRue0q6oL8aRWswk.json',
  painmonger: 'dditems/_source/Painmonger_6lQNn6RY1Kclydw8.json',
  primalTools: 'dditems/_source/Primal_Tools_xfi9WkEAJXYs86Bd.json',
  psychoAssault: 'fmmcitems/_source/Psycho_Assault_yZ3rXt8z1jlCHlu7.json',
  sideSplitter: 'mlpcrbitems/_source/Side_Splitter_o6h9U6oeWfpXYOA4.json',
  siphon: 'tfcrbitems/_source/Siphon_Fc9DBgnZffr8VKDU.json',
  spite: 'bthitems/_source/Spite_Gadtv1eSeFgNotSw.json',
  suffer: 'fmmcitems/_source/Suffer__4wCGBUae2VvEDVs9.json',
  quickAndQuiet: 'kocitems/_source/Quick_and_Quiet_nMS83Zn6qgFpIpmE.json',
  voiceOfNightVale: 'wtnvcgitems/_source/Voice_of_Night_Vale_wC7hyjoYTVRQo5LZ.json',
  tearDown: 'ccitems/_source/Tear_Down_ZrJG5EJVVZWcP8fo.json',
  hud: 'ccitems/_source/HUD_cx6cVaHALQlwBrnD.json',
  weaponCustomizer: 'iafav2items/_source/Weapon_Customizer_UWEU7hfmtRxlkWJB.json',
  elementalAdaptation: 'bthitems/_source/Elemental_Adaptation_06JVZqlBDXIfPKw8.json',
  reinforcedShell: 'tsitems/_source/Armor_Upgrade_Reinforced_Shell_GQt4IlyXGHCbLxNP.json',
  cleverMind: 'mlpcrbitems/_source/Clever_Mind_34WtMHugUN7Wp5bP.json',
  defensiveFlexibility: 'prcrbitems/_source/Defensive_Flexibility_7kHQ53hZFgwhSFVi.json',
  ironHide: 'gijcrbitems/_source/Iron_Hide_hXtchClOmMDDeWB9.json',
  numbness: 'fmmcitems/_source/Numbness_HB7e3uW1ggYNJVql.json',
  rottenTomatoes: 'mlpcrbitems/_source/Rotten_Tomatoes_0DcWZaKg0GVFV3ei.json',
  toughCrowd: 'mlpcrbitems/_source/Tough_Crowd_jKdu6PowM9GQkKW8.json',
  windWhispers: 'bthitems/_source/Wind_Whispers_JZgbPpDoFXctLBoH.json',
  monsterMorph: 'fmmcitems/_source/Monster_Morph_iDbMl3SS6XnyADN2.json',
  cacheI: 'dditems/_source/Cache_I_EEGQqqgqZEJkJDHB.json',
  specialProgram: 'jttitems/_source/Special_Program_wKGrImiofaMrni0m.json',
  weaponImplant: 'dditems/_source/Weapon_Implant_j9xrYUKHvLkxdd9e.json',
  gotToGetTough: 'gijcrbitems/_source/Got_To_Get_Tough_bIoMrn9aP9x6QYVL.json',
  mindOverMatter: 'gijcrbitems/_source/Mind_Over_Matter_eLO9NJ7akWmoPHEK.json',
  notDeadYet: 'iafav2items/_source/Not_Dead_Yet_mCsw25hT4y4q4ceG.json',
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
const { runUse, useAvailable, fireTriggers, fireItemAdded, wouldBeDefeated } = await import('./triggers.mjs');
const { ruleDerived, ruleRollSources, ruleDialogSwitches, ruleScaledDamage } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { runSteps, stepContext } = await import('./steps.mjs');
const { resolveValue } = await import('./formula.mjs');
const { bankedEntries, bankedSources, bankedDefense } = await import('./bank.mjs');
const { registerCheck, markOf } = await import('./predicate.mjs');
const { ignoreArmorAdjust } = await import('./plugins/combat/ignore-armor.mjs');
const { lateDefenseAdjust } = await import('./plugins/combat/defense-modes.mjs');
const { hitRiderOnAttack } = await import('./plugins/combat/hit-rider.mjs');
const { earlyRollRefusal } = await import('./plugins/rolls/early-before-roll.mjs');
const { clawGrappled } = await import('../mechanics/combat/grappled-snag.mjs');
const { favoriteWeaponOf } = await import('../items/shared/condition-damage-buttons.mjs');
const { isMonsterFormActive } = await import('../items/forms/monster-morph.mjs');
// mechanics/combat/sneak-attack.mjs#getPredatorSneakAttackDamage: 1 + one per Role level reached of 4, 8, 13, 17, 20.
const getPredatorSneakAttackDamage = level => 1 + [4, 8, 13, 17, 20].filter(at => at <= level).length;
// essence20.mjs registers these checks (items/forms/monster-morph.mjs#isMonsterFormActive, and from items/shared/condition-damage-buttons.mjs#favoriteWeaponOf.
registerCheck('monsterForm', actor => isMonsterFormActive(actor));
registerCheck('favoriteWeaponRolled', (actor, option, ctx) => {
  const weapon = favoriteWeaponOf(actor);
  return !!weapon && !!ctx?.item && (ctx.item.id == weapon.id || ctx.item.flags?.essence20?.parentId == weapon.id);
});

const pay = jest.fn(async () => true);
let chooses = [];
const ask = async (step, options) => {
  const want = chooses.shift();
  const at = options.findIndex(option => option.label == want);
  return at < 0 ? null : at;
};

let numbers = [];
const askNumber = async () => numbers.shift() ?? null;
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
/*  Reach                                        */
/* -------------------------------------------- */

describe('Reach (weapon-effect.mjs used to double it)', () => {
  test('Antlers: an unarmed melee attack has double Reach; a held weapon, a ranged attack or a bigger multiplier do not change', () => {
    const actor = makeActor([packItem('antlers')]);
    const claw = effect(actor, { totalReach: 5 });
    const held = effect(actor, { totalReach: 5, parentId: 'w1' });
    const spit = effect(actor, { style: 'projectile', totalReach: 5 });
    const pike = effect(actor, { totalReach: 15, range: { reachMultiplier: 3 } });
    ruleDerived(actor);
    expect([claw.system.totalReach, held.system.totalReach, spit.system.totalReach, pike.system.totalReach]).toEqual([10, 5, 5, 15]);
  });

  // Book check 2026-10-06 (docs/rules-batches/book-durations.md): a Move action, lasting until your next turn starts.
  // Book check follow-ups 2026-10-06: ONE picked Melee weapon (the pick and its doubling: book-followups.test.js).
  test('Extended Attack: a Move action doubles a picked Melee weapon\'s Reach until your next turn (out of combat, the scene)', async () => {
    const perk = packItem('extendedAttack');
    const actor = makeActor([perk]);
    const sword = effect(actor, { totalReach: 5, parentId: 'w1' });
    const gun = effect(actor, { style: 'projectile', totalReach: 5 });
    // Picked (the weapon w1), switched on until the next turn.
    perk.flags.essence20.rules = { choices: { extended: 'w1' }, toggles: { on: true }, toggleUntil: { on: { until: 'nextTurnOrScene', stamp: { epoch: 1 } } } };
    rebuildIndex(actor);
    ruleDerived(actor);
    expect([sword.system.totalReach, gun.system.totalReach]).toEqual([10, 5]);
    global.game.settings = { ...global.game.settings, get: () => 2 };
    sword.system.totalReach = 5;
    ruleDerived(actor);
    expect(sword.system.totalReach).toBe(5);
    const [use] = perk.system.rules;
    expect([use.cost, use.steps[0].do, use.steps[0].from, use.steps[1].until]).toEqual([{ action: 'move' }, 'pick', 'ownedItem', 'nextTurnOrScene']);
  });
});

/* -------------------------------------------- */
/*  Hit Triggers and their buttons               */
/* -------------------------------------------- */

describe('hits', () => {
  test('Assault Claw: a Grapple hit marks the target for the scene (the Grappled switch reads it); another hit does not', async () => {
    const attacker = makeActor();
    const claw = packItem('assaultClaw');
    claw.parent = attacker;
    attacker.items.contents.push(claw);
    rebuildIndex(attacker);
    const slash = effect(attacker, { parentId: claw.id, damageType: 'sharp' });
    const grab = effect(attacker, { parentId: claw.id, damageType: 'grapple' });
    const target = makeActor([], { name: 'Foe', statuses: ['grappled'] });
    await hit(attacker, target, { item: slash, isAttack: true });
    expect(clawGrappled(target)).toBe(false);
    await hit(attacker, target, { item: grab, isAttack: true });
    expect(clawGrappled(target)).toBe(true);
    expect(target.flags.essence20.ruleMarks.assaultClawGrapple).toMatchObject({ by: attacker.uuid, until: 'scene' });
  });

  test('Crippling Blow: a ↓1 switch on melee attacks; on a hit with it, the chosen Condition - or Bleed \'Em Dry\'s Energon drain', async () => {
    const actor = makeActor([packItem('cripplingBlow')]);
    const fist = effect(actor);
    const gun = effect(actor, { style: 'projectile' });
    const sw = ruleDialogSwitches(actor, { item: fist, isAttack: true, isMelee: true }).find(s => /Crippling/.test(s.label));
    expect(sw).toBeTruthy();
    expect(ruleDialogSwitches(actor, { item: gun, isAttack: true, isMelee: false }).some(s => /Crippling/.test(s.label))).toBe(false);
    const target = makeActor([], { name: 'Foe' });
    await hit(actor, target, { item: fist, isAttack: true, switches: [] });
    expect(conditions).toEqual([]);
    chooses = ['Prone'];
    await fireTriggers(actor, 'hit', { roll: { item: fist, isAttack: true, switches: ['cripplingBlow'] }, outcome: 'success', targets: [target], facts: { results: [{ success: true }] }, ask });
    expect(conditions).toEqual([{ name: 'Foe', status: 'prone', rounds: 0 }]);

    actor.items.contents.push(Object.assign(sourced('oeGoFl2hwcPfMWCr', { name: "Bleed 'Em Dry" }), { parent: actor }));
    rebuildIndex(actor);
    conditions.length = 0;
    const bot = makeActor([], { name: 'Bot', system: { energon: { normal: { value: 3 } } } });
    await fireTriggers(actor, 'hit', { roll: { item: fist, isAttack: true, switches: ['cripplingBlow'] }, outcome: 'success', targets: [bot], facts: { results: [{ success: true }] }, ask });
    expect(conditions).toEqual([]);
    expect([1, 2]).toContain(bot.system.energon.normal.value);
    const empty = makeActor([], { name: 'Empty', system: { energon: { normal: { value: 0 } } } });
    await fireTriggers(actor, 'hit', { roll: { item: fist, isAttack: true, switches: ['cripplingBlow'] }, outcome: 'success', targets: [empty], facts: { results: [{ success: true }] }, ask });
    expect(empty.system.energon.normal.value).toBe(0);
  });

  test('Deconstructionist: a Technology switch; a hit with it banks a Snag on the target\'s next roll', async () => {
    const actor = makeActor([packItem('deconstructionist')]);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'technology' }).some(s => /Deconstructionist/.test(s.label))).toBe(true);
    expect(ruleDialogSwitches(actor, { rolledSkill: 'athletics' }).some(s => /Deconstructionist/.test(s.label))).toBe(false);
    // A vehicle: every test it makes (a creature's: only those using the picked equipment - book-followups.test.js).
    const target = makeActor([], { name: 'Tank', type: 'vehicle', system: { traits: { computerized: true } } });
    await hit(actor, target, { rolledSkill: 'technology', switches: ['deconstructionist'] }, [{ success: true }]);
    expect(bankedEntries(target)).toHaveLength(1);
    expect(bankedSources(target, null, { rolledSkill: 'athletics' }).sources[0]).toMatchObject({ snag: true });
  });

  test('Painmonger: a damaging hit that deals Stun imposes Impaired for 1 round; another type or no damage does not', async () => {
    const actor = makeActor([packItem('painmonger')]);
    const target = makeActor([], { name: 'Foe' });
    await hit(actor, target, { rollDamageType: 'blunt' });
    await hit(actor, target, { rollDamageType: 'stun' }, [{ success: true, damageValue: 0 }]);
    expect(conditions).toEqual([]);
    await hit(actor, target, { rollDamageType: 'stun' });
    expect(conditions).toEqual([{ name: 'Foe', status: 'impaired', rounds: 1 }]);
  });

  test('Flashy (+ Technologist, Multiplication): an Electric hit offers a Science-vs-Toughness button; success Blinds 2 rounds', async () => {
    const flashy = packItem('flashy');
    const actor = makeActor([flashy], { system: { skills: { science: { shift: 'd4' }, technology: { shift: 'd8' } } } });
    const zap = effect(actor, { damageType: 'electric', style: 'projectile' });
    const punch = effect(actor);
    const target = makeActor([], { name: 'Foe' });
    await hit(actor, target, { item: punch, isAttack: true });
    expect(buttons()).toEqual([]);
    await hit(actor, target, { item: zap, isAttack: true });
    const [button] = buttons();
    expect(button.label).toBe('Flashy (Science vs. Toughness)');
    expect(button.targets).toEqual([target.uuid]);
    await press(button, actor, flashy);
    expect(rollsMade).toEqual([{ skill: 'science', dif: 12 }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'blinded', rounds: 2 }]);

    for (const id of ['tdFzQ0IOtoHQ0vmy', 'K3FNcAMjjek1UaJk']) {
      actor.items.contents.push(Object.assign(sourced(id), { parent: actor }));
    }

    rebuildIndex(actor);
    rollsMade.length = 0;
    conditions.length = 0;
    await press(button, actor, flashy);
    expect(rollsMade).toEqual([{ skill: 'technology', dif: 12 }]);
    expect(conditions).toEqual([{ name: 'Foe', status: 'blinded', rounds: 4 }]);
    rolls = [{ success: false }];
    conditions.length = 0;
    await press(button, actor, flashy);
    expect(conditions).toEqual([]);
  });

  test('Frenzied Attack: a damaging unarmed hit with Energon offers the follow-up button (spend 1 Energon, a Free action, the same attack)', async () => {
    const actor = makeActor([packItem('frenziedAttack')]);
    const claw = effect(actor);
    const sword = effect(actor, { parentId: 'w1' });
    const target = makeActor([], { name: 'Foe' });
    await hit(actor, target, { item: sword, isAttack: true });
    await hit(actor, target, { item: claw, isAttack: true }, [{ success: true, damageValue: 0 }]);
    expect(buttons()).toEqual([]);
    await hit(actor, target, { item: claw, isAttack: true });
    const [button] = buttons();
    expect(button.steps.map(step => step.do)).toEqual(['spend', 'grantActions', 'attack']);
    expect(button.steps[2]).toMatchObject({ item: 'rolled' });
    actor.system.energon.normal.value = 0;
    ChatMessage.create.mockClear();
    await hit(actor, target, { item: claw, isAttack: true });
    expect(buttons()).toEqual([]);
  });

  test('Spite: a missed attack offers 1 Personal Power for an Edge on the next attack against that target', async () => {
    const spite = packItem('spite');
    const actor = makeActor([spite]);
    const target = makeActor([], { name: 'Foe' });
    const other = makeActor([], { name: 'Other' });
    await fireTriggers(actor, 'miss', { roll: { isAttack: true }, outcome: 'failure', targets: [target], facts: { results: [{ success: false }] } });
    const [button] = buttons();
    await press(button, actor, spite);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(ruleRollSources(actor, other, { isAttack: true }).sources).toEqual([]);
    expect(ruleRollSources(actor, target, { isAttack: true }).sources[0]).toMatchObject({ edge: true });
    actor.system.powers.personal.value = 0;
    ChatMessage.create.mockClear();
    await fireTriggers(actor, 'miss', { roll: { isAttack: true }, outcome: 'failure', targets: [target], facts: { results: [{ success: false }] } });
    expect(buttons()).toEqual([]);
  });

  test('Suffer!: a damaging hit offers Impaired for any amount of Personal Power', async () => {
    const suffer = packItem('suffer');
    const actor = makeActor([suffer]);
    const target = makeActor([], { name: 'Foe' });
    await hit(actor, target, { isAttack: true }, [{ success: true, damageValue: 0 }]);
    expect(buttons()).toEqual([]);
    await hit(actor, target, { isAttack: true });
    const [button] = buttons();
    expect(button.usedWhenDone).toBe(true);
    numbers = [2];
    await press(button, actor, suffer, { askNumber });
    expect(actor.system.powers.personal.value).toBe(1);
    expect(conditions).toEqual([{ name: 'Foe', status: 'impaired', rounds: 0 }]);
  });
});

/* -------------------------------------------- */
/*  Uses                                         */
/* -------------------------------------------- */

describe('Uses', () => {
  test('Charge It Up!: 1 Personal Power while Morphed marks the next melee Power Weapon attack, which ignores armor and uses it up', async () => {
    const power = packItem('chargeItUp');
    const actor = makeActor([power], { system: { isMorphed: true } });
    const staff = weapon(actor, { traits: ['powerWeapon'] });
    const hitWith = effect(actor, { parentId: staff.id });
    const defender = makeActor([], { name: 'Foe' });
    expect(ignoreArmorAdjust(actor, defender, 'toughness', { item: hitWith })).toBe(0);
    await use(power);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(markOf(actor, 'chargeItUp')).toBe(true);
    expect(ignoreArmorAdjust(actor, defender, 'toughness', { item: hitWith })).toBe(-2);
    await fireTriggers(actor, 'afterRoll', { roll: { item: hitWith, isAttack: true, isMelee: true }, outcome: 'success', facts: { results: [{ success: true }] } });
    expect(markOf(actor, 'chargeItUp')).toBe(false);

    // Not Morphed: refused before anything is spent (book check 2026-10-06 - docs/rules-batches/book-costs.md).
    actor.system.isMorphed = false;
    expect(await use(power)).toContain('requires being Morphed');
    expect(actor.system.powers.personal.value).toBe(2);
    expect(markOf(actor, 'chargeItUp')).toBe(false);
  });

  test('Create Weapon: grows the chosen Close Combat weapon, not a second copy of one already held', async () => {
    const BLADE = C('gi_joe_crb', '8lNIijY5XompKHH7');
    const CLUB = C('gi_joe_crb', 'ZNokHTRBa5aindap');
    CATALOG.push({ uuid: BLADE, name: 'Close Combat Blade', type: 'weapon', system: {} }, { uuid: CLUB, name: 'Close Combat Bludgeoning', type: 'weapon', system: {} });
    const power = packItem('createWeapon', { system: { usesPer: 10, usesSpent: 0 } });
    const actor = makeActor([power]);
    chooses = ['Short blade'];
    await use(power);
    expect(actor.items.contents.filter(item => item.name == 'Close Combat Blade')).toHaveLength(1);
    chooses = ['Short blade'];
    await use(power);
    expect(actor.items.contents.filter(item => item.name == 'Close Combat Blade')).toHaveLength(1);
    chooses = ['Short bludgeon'];
    await use(power);
    expect(actor.items.contents.filter(item => item.name == 'Close Combat Bludgeoning')).toHaveLength(1);
    // Each use spends one of the nanomite Power's daily uses (as its activation did), even a cancelled pick.
    expect(power.system.usesSpent).toBe(3);
    chooses = [];
    await use(power);
    expect(power.system.usesSpent).toBe(4);
    power.system.usesSpent = 10;
    expect(available(power)).toBe(false);
  });

  test('Favorite Weapon: picks a two-handed, non-Integrated Targeting weapon (its `weapon` pick - Perk choice P2e); attacks with it get ↑1', async () => {
    const perk = packItem('favoriteWeapon', { source: C('decepticon_directive', 'emaXxo2XzoHMoNCe') });
    const actor = makeActor([perk]);
    const rifle = weapon(actor, { name: 'Rifle' });
    const rifleShot = effect(actor, { parentId: rifle.id, style: 'projectile', skill: 'targeting', numHands: 2 });
    const pistol = weapon(actor, { name: 'Pistol' });
    effect(actor, { parentId: pistol.id, style: 'projectile', skill: 'targeting', numHands: 1 });
    const cannon = weapon(actor, { name: 'Arm Cannon', size: 'integrated' });
    effect(actor, { parentId: cannon.id, style: 'projectile', skill: 'targeting', numHands: 2 });
    picks = ['Rifle'];
    await use(perk);
    expect(offered[0]).toEqual(['Rifle']);
    expect(perk.flags.essence20.rules.choices.weapon).toBe(rifle.id);
    expect(perk.system.choice ?? null).toBeNull();
    expect(favoriteWeaponOf(actor)).toBe(rifle);
    expect(ruleRollSources(actor, null, { item: rifleShot, isAttack: true }).sources[0]).toMatchObject({ shiftUp: 1 });
    const pistolShot = actor.items.contents.find(item => item.flags.essence20.parentId == pistol.id);
    expect(ruleRollSources(actor, null, { item: pistolShot, isAttack: true }).sources).toEqual([]);
  });

  test('Psycho Assault: Morphed, out of Monster Form, 1 Personal Power: ↑1 and +1 damage on attacks for the rest of the turn', async () => {
    const perk = packItem('psychoAssault');
    const actor = makeActor([perk], { system: { isMorphed: true } });
    game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [] };
    expect(available(perk)).toBe(true);
    await use(perk);
    expect(actor.system.powers.personal.value).toBe(2);
    const swing = effect(actor);
    expect(ruleRollSources(actor, null, { item: swing, isAttack: true }).sources[0]).toMatchObject({ shiftUp: 1 });
    expect(ruleScaledDamage(actor, null, { item: swing, isAttack: true }).amount).toBe(1);

    actor.flags.essence20.monsterFormActive = true;
    rebuildIndex(actor);
    expect(available(perk)).toBe(false);
    actor.flags.essence20.monsterFormActive = false;
    actor.system.isMorphed = false;
    rebuildIndex(actor);
    expect(available(perk)).toBe(false);
  });

  test('Side Splitter: Performance against the chosen Defense of a target; a hit deals 1 Blunt', async () => {
    const perk = packItem('sideSplitter');
    makeActor([perk]);
    expect(await use(perk)).toContain('NeedsTarget');
    const target = makeActor([], { name: 'Foe' });
    game.user.targets = new Set([{ actor: target }]);
    chooses = ['Cleverness'];
    await use(perk);
    expect(vsMany).toEqual([{ skill: 'performance', defense: 'cleverness', targets: ['Foe'] }]);
    expect(dealt).toEqual([{ name: 'Foe', amount: 1, type: 'blunt' }]);
  });

  test('Siphon: Technology against Toughness or Evasion; a hit takes 1 Health outright and gives 1 Energon past the maximum', async () => {
    const perk = packItem('siphon');
    const actor = makeActor([perk], { system: { energon: { normal: { value: 5, max: 5 } } } });
    const target = makeActor([], { name: 'Foe', system: { health: { value: 4, max: 10 } } });
    game.user.targets = new Set([{ actor: target }]);
    chooses = ['Evasion'];
    await use(perk);
    expect(vsMany[0]).toMatchObject({ skill: 'technology', defense: 'evasion' });
    expect(target.system.health.value).toBe(3);
    expect(actor.system.energon.normal.value).toBe(6);
  });

  test('Quick and Quiet / Voice of Night Vale: only in the first round; Surprise the target / every enemy hit', async () => {
    const quick = packItem('quickAndQuiet');
    const voice = packItem('voiceOfNightVale');
    makeActor([quick, voice]);
    expect([available(quick), available(voice)]).toEqual([false, false]);
    game.combat = { id: 'c1', started: true, round: 2, turn: 0, combatants: [] };
    expect(available(quick)).toBe(false);
    game.combat.round = 1;
    expect([available(quick), available(voice)]).toEqual([true, true]);
    const target = makeActor([], { name: 'Foe' });
    game.user.targets = new Set([{ actor: target }]);
    await use(quick);
    expect(conditions).toEqual([{ name: 'Foe', status: 'surprised', rounds: 0 }]);
    expect(voice.system.rules[0].steps[0]).toMatchObject({ do: 'rollVsEach', skill: 'intimidation', defense: 'willpower', to: 'enemies:60' });
  });

  test('Tear Down: Intimidation vs Willpower marks the target; the next attack on it gets +1 damage and uses it up', async () => {
    const perk = packItem('tearDown');
    const actor = makeActor([perk]);
    const target = makeActor([], { name: 'Foe' });
    const other = makeActor([], { name: 'Other' });
    game.user.targets = new Set([{ actor: target }]);
    await use(perk);
    expect(vsMany[0]).toMatchObject({ skill: 'intimidation', defense: 'willpower' });
    const swing = effect(actor);
    expect(ruleScaledDamage(actor, other, { item: swing, isAttack: true }).amount).toBe(0);
    const bonus = ruleScaledDamage(actor, target, { item: swing, isAttack: true });
    expect(bonus).toMatchObject({ amount: 1, sources: ['Tear Down'] });
    await bonus.spend();
    expect(ruleScaledDamage(actor, target, { item: swing, isAttack: true }).amount).toBe(0);
  });

  test('HUD: a Move action once per turn in combat; ↑1 on the chosen Skill until the turn ends', async () => {
    const hud = packItem('hud');
    const actor = makeActor([hud], { system: { skills: { athletics: { shift: 'd4' }, might: { shift: 'd6' } } } });
    expect(available(hud)).toBe(false);
    game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatants: [] };
    picks = ['might'];
    await use(hud);
    expect(pay).toHaveBeenCalledWith('move');
    expect(ruleRollSources(actor, null, { rolledSkill: 'might' }).sources[0]).toMatchObject({ shiftUp: 1 });
    expect(ruleRollSources(actor, null, { rolledSkill: 'athletics' }).sources).toEqual([]);
    expect(available(hud)).toBe(false);
  });

  test('Weapon Customizer: marks or unmarks the chosen weapon customized (weapon-traits.mjs adds Temperamental)', async () => {
    const perk = packItem('weaponCustomizer');
    const actor = makeActor([perk]);
    const gun = weapon(actor, { name: 'Gun' });
    picks = ['Gun'];
    expect(await use(perk)).toContain('Temperamental now');
    expect(gun.flags.essence20.customized).toBe(true);
    picks = ['Gun'];
    expect(await use(perk)).toContain('no longer marked');
    expect(gun.flags.essence20.customized).toBe(false);
  });

  test('Rotten Tomatoes / Tough Crowd: Cheer Points spent become a Toughness+Evasion / Willpower+Cleverness bonus for the combat', async () => {
    const cheer = makeItem({ name: 'Cheer Points', type: 'rolePoints', system: { resource: { value: 3, max: 3 } } });
    const tomatoes = packItem('rottenTomatoes');
    const crowd = packItem('toughCrowd');
    const actor = makeActor([cheer, tomatoes, crowd]);
    numbers = [2];
    await runUse(tomatoes, pay, { ask, askNumber });
    expect(cheer.system.resource.value).toBe(1);
    expect(await bankedDefense(actor, 'toughness')).toBe(2);
    expect(await bankedDefense(actor, 'evasion')).toBe(2);
    expect(await bankedDefense(actor, 'toughness')).toBe(2);
    expect(await bankedDefense(actor, 'willpower')).toBe(0);
    numbers = [1];
    await runUse(crowd, pay, { ask, askNumber });
    expect(await bankedDefense(actor, 'cleverness')).toBe(1);
    expect(available(tomatoes)).toBe(false);
  });

  test('Clever Mind: 1 Cheer Point; the next attack meets Cleverness instead, and uses it up', async () => {
    const cheer = makeItem({ name: 'Cheer Points', type: 'rolePoints', system: { resource: { value: 1, max: 3 } } });
    const perk = packItem('cleverMind');
    const actor = makeActor([cheer, perk]);
    await use(perk);
    expect(cheer.system.resource.value).toBe(0);
    const attacker = makeActor([], { name: 'Foe' });
    expect(lateDefenseAdjust(attacker, actor, 'toughness', {})).toBe(3);
    expect(lateDefenseAdjust(attacker, actor, 'cleverness', {})).toBe(0);
    await fireTriggers(actor, 'targeted', { roll: { defenseType: 'cleverness' }, outcome: 'success', targets: [attacker], facts: { results: [{ success: true }] } });
    expect(markOf(actor, 'cleverMind')).toBe(true);
    await fireTriggers(actor, 'targeted', { roll: { defenseType: 'evasion' }, outcome: 'failure', targets: [attacker], facts: { results: [{ success: false }] } });
    expect(markOf(actor, 'cleverMind')).toBe(false);
  });

  test('Monster Morph: on (a Psycho Path, 3 Personal Power) - Large, +2 Health bonus, the flag; off - the Size back, the bonus gone, Grow! ended', async () => {
    const perk = packItem('monsterMorph');
    const path = sourced('vWie8Dy4u54sf1hy', { type: 'role', name: 'Path of Cruelty' });
    const actor = makeActor([perk, path]);
    expect(await use(perk)).toContain('transforms into their Monster Form');
    expect(actor.system).toMatchObject({ size: 'large', health: { bonus: 2 }, powers: { personal: { value: 0 } } });
    expect(actor.flags.essence20.monsterFormActive).toBe(true);
    actor.flags.essence20.monsterGrowSelfActive = true;
    expect(await use(perk)).toContain('reassumes their Ranger form');
    expect(actor.system).toMatchObject({ size: 'common', health: { bonus: 0 } });
    expect(actor.flags.essence20).toMatchObject({ monsterFormActive: false, monsterGrowSelfActive: false });

    const noPath = makeActor([packItem('monsterMorph')]);
    expect(await use(noPath.items.contents[0])).toBeNull();
    expect(noPath.system.powers.personal.value).toBe(3);
  });

  test('Cache I: once per encounter (2 with Cache II, 3 with Cache III); Private Barter applies once per encounter', async () => {
    const cache = packItem('cacheI');
    makeActor([cache]);
    expect(await use(cache)).not.toContain('Private Barter');
    expect(available(cache)).toBe(false);

    const rich = makeActor([packItem('cacheI'), sourced('VMd10Qb4ByeCla5q', { name: 'Cache III' }), sourced('mzOtnEnXRhCM0v9O', { name: 'Private Barter' })]);
    const item = rich.items.contents[0];
    expect(await use(item)).toContain('Private Barter applies');
    expect(await use(item)).not.toContain('Private Barter');
    expect(available(item)).toBe(true);
    await use(item);
    expect(available(item)).toBe(false);
  });

  test('Mind Over Matter: Intimidation or Persuasion at DIF 5 + 5 x the amount; success heals the target and stands them up', async () => {
    const perk = packItem('mindOverMatter');
    makeActor([perk]);
    const target = makeActor([], { name: 'Ally', statuses: ['defeated'], system: { health: { value: 0, max: 10 } } });
    game.user.targets = new Set([{ actor: target }]);
    chooses = ['Persuasion'];
    numbers = [3];
    await runUse(perk, pay, { ask, askNumber });
    expect(rollsMade).toEqual([{ skill: 'persuasion', dif: 20 }]);
    expect(target.system.health.value).toBe(3);
    expect(target.statuses.has('defeated')).toBe(false);
  });

  test('Not Dead Yet: +1 Health (bonus and value) once per scene, +2 once per encounter with CSTO Personnel nearby', async () => {
    const perk = packItem('notDeadYet');
    makeActor([perk], { name: 'Soldier', system: { health: { value: 5, max: 10, bonus: 0 } } });
    temp.length = 0;
    await use(perk);
    // Book check follow-ups 2026-10-06: temporary Health that goes with the scene (the temporary-resources ledger).
    expect(temp).toEqual([expect.objectContaining({ name: 'Soldier', kind: 'health', amount: 1 })]);
    expect(available(perk)).toBe(false);
  });

  test('Special Program: a General Perk is picked and granted when added, and the Use stays only until something was granted', async () => {
    CATALOG.push({ uuid: 'Compendium.essence20.x.Item.gen', name: 'Brave', type: 'perk', system: { type: 'general' } }, { uuid: 'Compendium.essence20.x.Item.role', name: 'Role Thing', type: 'perk', system: { type: 'role' } });
    const perk = packItem('specialProgram');
    const actor = makeActor([perk]);
    picks = ['Brave'];
    await fireItemAdded(actor, perk);
    expect(offered[0]).toEqual(['Brave']);
    expect(actor.items.contents.some(item => item.name == 'Brave')).toBe(true);
    expect(available(perk)).toBe(false);
    const old = makeActor([packItem('specialProgram', { flags: { o1Picked: 'x' } })]);
    expect(available(old.items.contents[0])).toBe(false);
  });

  test('Elemental Adaptation / Wind Whispers: when added, pick (an element and) yourself or a teammate', async () => {
    const adapt = packItem('elementalAdaptation');
    const actor = makeActor([adapt]);
    const mate = makeActor([], { name: 'Mate' });
    game.actors = ALL.filter(doc => doc.documentName == 'Actor');
    picks = ['fire', mate.uuid];
    await fireItemAdded(actor, adapt);
    expect(mate.flags.essence20.aquaElementalAdaptations).toEqual(['fire']);

    const whispers = packItem('windWhispers');
    const holder = makeActor([whispers], { system: { defenses: { evasion: { bonus: 1 } } } });
    game.actors = ALL.filter(doc => doc.documentName == 'Actor');
    picks = [holder.uuid];
    await fireItemAdded(holder, whispers);
    expect(holder.system.defenses.evasion.bonus).toBe(3);
  });

  test('Primal Tools: when added, an integrated Primal Tools weapon with Stun 1 and Sharp 1 attacks (Multiple Targets, ↓1)', async () => {
    const perk = packItem('primalTools');
    const actor = makeActor([perk]);
    await fireItemAdded(actor, perk);
    const tools = actor.items.contents.find(item => item.type == 'weapon');
    expect(tools).toMatchObject({ name: 'Primal Tools', system: { classification: { size: 'integrated' }, equipped: true } });
    const attacks = actor.items.contents.filter(item => item.type == 'weaponEffect');
    expect(attacks.map(item => [item.name, item.system.damageType, item.system.numTargets, item.system.shiftDown, item.flags.essence20.parentId]))
      .toEqual([['Primal Tools (Stun)', 'stun', 2, 1, tools.id], ['Primal Tools (Sharp)', 'sharp', 2, 1, tools.id]]);
  });
});

/* -------------------------------------------- */
/*  Weapon effects, Defenses, resistances, damage */
/* -------------------------------------------- */

describe('the once-per-encounter weapon effects', () => {
  test.each([['ttcEnergy', 'ttcAlternate'], ['tlsEnergy', 'tlsAlternate'], ['wingBlast', 'wingCone']])('%s and %s share one use per encounter, refused before the roll', async (a, b) => {
    const actor = makeActor();
    const first = packItem(a);
    const second = packItem(b);
    for (const item of [first, second]) {
      item.parent = actor;
      actor.items.contents.push(item);
    }

    rebuildIndex(actor);
    expect(earlyRollRefusal(actor, first)).toBeNull();
    await fireTriggers(actor, 'afterRoll', { roll: { item: first, isAttack: true }, outcome: 'any', facts: { results: [], open: true } });
    expect(earlyRollRefusal(actor, second)).toBe('E20.LimitedWeaponEffectAlreadyUsed');
    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(earlyRollRefusal(actor, effect(actor))).toBeNull();
  });
});

describe('Defenses and resistances', () => {
  test('Defensive Flexibility: +2 to the chosen Defense against attacks while Morphed; or the chosen Resistance', () => {
    const perk = packItem('defensiveFlexibility', { system: { choice: 'defenseEvasion' } });
    const actor = makeActor([perk], { system: { isMorphed: true } });
    const attacker = makeActor([], { name: 'Foe' });
    expect(lateDefenseAdjust(attacker, actor, 'evasion', {})).toBe(2);
    expect(lateDefenseAdjust(attacker, actor, 'toughness', {})).toBe(0);
    actor.system.isMorphed = false;
    expect(lateDefenseAdjust(attacker, actor, 'evasion', {})).toBe(0);

    const resist = makeActor([packItem('defensiveFlexibility', { system: { choice: 'resistanceFire' } })]);
    ruleDerived(resist);
    expect(resist.system.resistances).toEqual({ fire: true });
  });

  test('Numbness: Stun from 1st level, Psychic at 6th, Blunt at 12th, every Energy type at 18th (NPCs by Threat Level)', () => {
    const at = level => {
      const actor = makeActor([packItem('numbness')], { system: { level } });
      ruleDerived(actor);
      return Object.keys(actor.system.resistances).sort();
    };

    expect(at(5)).toEqual(['stun']);
    expect(at(6)).toEqual(['psychic', 'stun']);
    expect(at(12)).toEqual(['blunt', 'psychic', 'stun']);
    expect(at(18)).toEqual(['acid', 'blunt', 'cold', 'electric', 'element', 'emp', 'energy', 'fire', 'laser', 'psychic', 'sonic', 'stun']);
    const npc = makeActor([packItem('numbness')], { type: 'npc', system: { level: undefined, threatLevel: 6 } });
    ruleDerived(npc);
    expect(Object.keys(npc.system.resistances).sort()).toEqual(['psychic', 'stun']);
  });

  test('Reinforced Shell: its +2 comes back off Toughness out of Alt Mode; Bot Mode adds 1 to an unarmed Stun hit', () => {
    const shell = packItem('reinforcedShell');
    shell.system.armorBonus = { value: 2, defense: 'toughness' };
    const actor = makeActor([shell], { system: { canTransform: true, isTransformed: false } });
    ruleDerived(actor);
    expect(actor.system.defenses.toughness.total).toBe(10);
    const alt = makeActor([packItem('reinforcedShell')], { system: { canTransform: true, isTransformed: true } });
    alt.items.contents[0].system.armorBonus = { value: 2 };
    ruleDerived(alt);
    expect(alt.system.defenses.toughness.total).toBe(12);
    const notes = [];
    const fist = effect(actor, { damageType: 'stun' });
    const tools = { damageBonusNote: (result, amount, label) => notes.push({ amount, label }) };
    hitRiderOnAttack(actor, makeActor([], { name: 'Foe' }), { success: true, damageValue: 2, damageType: 'stun' }, { itemUuid: fist.uuid, damageType: 'stun' }, tools);
    expect(notes).toEqual([{ amount: 1, label: 'Reinforced Shell (Bot Mode: +1 unarmed Stun)' }]);
    hitRiderOnAttack(alt, makeActor([], { name: 'Foe' }), { success: true, damageValue: 2, damageType: 'stun' }, { itemUuid: effect(alt, { damageType: 'stun' }).uuid, damageType: 'stun' }, tools);
    expect(notes).toHaveLength(1);
  });

  test('Iron Hide: about to be Defeated by non-Stun damage, a Story Point and a Brawn DIF 15 success negate it', async () => {
    const actor = makeActor([packItem('ironHide')]);
    actor.items.contents[0].system.rules[0].prompt = false;
    rebuildIndex(actor);
    expect(actor.items.contents[0].system.rules[0]).toMatchObject({ event: 'wouldBeDefeated', when: ['not:damage:stun', 'self:canSpendStoryPoints'] });
    expect(actor.items.contents[0].system.rules[0].steps[1]).toMatchObject({ do: 'roll', skill: 'brawn', dif: 15, onSuccess: [{ do: 'negateDamage' }] });
    expect(typeof wouldBeDefeated).toBe('function');
  });

  test('Got To Get Tough: rolling Initiative gives allies within 30 ft 1 tracked temporary Health until they take damage', () => {
    const rule = fromPack(FILES.gotToGetTough).system.rules[0];
    expect(rule).toMatchObject({ event: 'initiativeRolling', steps: [{ do: 'heal', amount: 1, temporary: true, tracked: true, untilDamage: true, to: 'allies:30' }] });
  });

  // (Weapon Implant is a once-per-mission Use button that rolls its own test now - book check 2026-10-06:
  // rules/book-limits.test.js.)

  test('Sneak Attack (Force Recon): an attack switch adding a Commando\'s sneak attack damage of the actor\'s level', () => {
    const actor = makeActor([packItem('sneakAttack')]);
    const fist = effect(actor);
    const sw = ruleDialogSwitches(actor, { item: fist, isAttack: true }).find(s => /Sneak Attack/.test(s.label));
    expect(sw).toBeTruthy();
    const rule = fromPack(FILES.sneakAttack).system.rules[0];
    for (let level = 1; level <= 20; level++) {
      expect([level, resolveValue(rule.damage, { actor: { system: { level } } })]).toEqual([level, getPredatorSneakAttackDamage(level)]);
    }
  });
});
