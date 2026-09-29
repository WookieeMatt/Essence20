import { registerCostRule, registerDerived, registerPreRoll, registerPostRoll, registerSpecializes, registerUse } from "../../extensions.mjs";
import { getMissionEpoch, getSceneEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";
import { effectsOf, has, itemOf, itemsOf, parentWeapon, Q2, SILENT_BATTLEDRESS, sourceOf, T, traitsOf } from "./common.mjs";

/**
 * Equipment Training and Qualification Perks (qualify2 slice).
 *
 * G.I. Joe CRB p.72/80: "You can requisition any battledress and weapons you are trained in ... You
 * can access any equipment you are Qualified in without requisitioning it." In this system that is
 * Requisition (helpers/requisition.mjs), which asks two hooks the qualify1 slice added:
 *   essence20.requisitionAccess (actor, item, out)        out.access 'qualified'|'trained'|'none'|'unknown'
 *   essence20.requisitionAvailability (actor, item, out)  out.availability, the tier the DIF is read from
 * The hook bodies here only ever widen access / lower the tier. Each Perk with a "take it" half also
 * gets a Use button that pulls a qualifying item straight from the compendium (flagged qualified,
 * no Requisition Test) - "access ... without requisitioning it".
 */

const TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];
const tierRank = tier => TIERS.indexOf(tier ?? 'standard');
const atMost = (tier, cap) => tierRank(tier) >= 0 && tierRank(tier) <= tierRank(cap);
const norm = name => String(name ?? '').trim().toLowerCase();

export const CHOSEN_FLAG = 'q2Chosen';
export const TYPE_FLAG = 'q2WeaponType';
export const EVOLUTION_FLAG = 'q2Evolution';
export const MENTOR_FLAG = 'q2Mentor';
export const TRADE_SCHOOL_FLAG = 'q2TradeSchool';

export function chosenOn(perk) {
  return perk?.flags?.essence20?.[CHOSEN_FLAG] ?? [];
}

function matchesChosen(item, chosen) {
  const source = sourceOf(item) ?? item?.uuid;
  return !!((chosen?.uuid && (chosen.uuid == source || chosen.uuid == item?.uuid))
    || (chosen?.name && norm(chosen.name) == norm(item?.name)));
}

/* -------------------------------------------- */
/*  Weapon shapes                                */
/* -------------------------------------------- */

export function isTwoHanded(weapon) {
  return effectsOf(weapon).some(effect => String(effect?.numHands ?? '1') == '2');
}

// Whisper Warrior (Intercontinental Adventures, Arashikage Focus, p.12): "You are Qualified with all
// weapons with the Martial Arts and Silent traits."
export function isSilentMartialArts(weapon) {
  const traits = traitsOf(weapon);
  return traits.includes('martialArts') && traits.includes('silent');
}

// Hardware Training (Enigma of Combination p.31): "Qualified in Restricted two-handed ballistic weapons".
export function isHardwareWeapon(weapon) {
  return traitsOf(weapon).includes('ballistic') && isTwoHanded(weapon)
    && atMost(weapon?.system?.availability, 'restricted');
}

// Words a weapon's name uses for each CONFIG.E20.weaponTypes key, where no trait carries the type.
const TYPE_WORDS = {
  assaultRifle: /assault rifle|carbine/i,
  blunt: /bludgeon|club|baton|hammer|mace/i,
  closeCombatHeavyBlade: /heavy blade|machete|axe|sword/i,
  explosives: /explosive|c-4|charge|mine|bomb/i,
  finesse: /finesse|knife|dagger|rapier/i,
  grenades: /grenade/i,
  mightMelee: /might/i,
  shotguns: /shotgun/i,
  submachineGun: /submachine|smg/i,
  thrown: /thrown|javelin|shuriken/i,
};
const TYPE_TRAITS = ['ballistic', 'element', 'martialArts', 'silent', 'stun', 'thrown'];

/**
 * Whether a weapon is of a CONFIG.E20.weaponTypes type. A weapon carries no type field, so: tagged
 * by the Weapon Enthusiast Use button, the same-named trait, one-handedness, or its name.
 */
export function weaponIsType(weapon, type) {
  if (!type || !weapon) {
    return false;
  }

  if (weapon.flags?.essence20?.[TYPE_FLAG] == type) {
    return true;
  }

  if (TYPE_TRAITS.includes(type) && traitsOf(weapon).includes(type)) {
    return true;
  }

  if (type == 'oneHanded') {
    const effects = effectsOf(weapon);
    return effects.length > 0 && effects.every(effect => String(effect?.numHands ?? '1') == '1');
  }

  return !!TYPE_WORDS[type]?.test(weapon.name ?? '');
}

function enthusiastType(actor) {
  return itemOf(actor, Q2.weaponEnthusiast)?.flags?.essence20?.[TYPE_FLAG]
    ?? itemOf(actor, Q2.weaponEnthusiastHangUp)?.flags?.essence20?.[TYPE_FLAG] ?? null;
}

/* -------------------------------------------- */
/*  Requisition                                  */
/* -------------------------------------------- */

/**
 * What this slice's Perks add to an actor's access to a weapon or armor.
 * @returns {?'qualified'|'trained'}
 */
export function perkAccess(actor, item) {
  if (!actor || !['weapon', 'armor'].includes(item?.type)) {
    return null;
  }

  const availability = item.system?.availability ?? 'standard';

  // A copy already taken through a "you are Qualified in ... of your choice" Use button.
  if (item.flags?.essence20?.qualified) {
    return 'qualified';
  }

  if (item.type == 'weapon') {
    // Oorah! (Sgt Slaughter Sourcebook p.15): "you are Qualified in all Standard weapons".
    if (has(actor, Q2.oorah) && atMost(availability, 'standard')) {
      return 'qualified';
    }

    if (has(actor, Q2.whisperWarrior) && isSilentMartialArts(item)) {
      return 'qualified';
    }

    if (has(actor, Q2.hardwareTraining) && isHardwareWeapon(item)) {
      return 'qualified';
    }

    // Weapon Enthusiast (Quartermaster's Guide p.15): "you become Qualified in one Limited weapon
    // type of your choice."
    const type = has(actor, Q2.weaponEnthusiast) ? enthusiastType(actor) : null;
    if (type && atMost(availability, 'limited') && weaponIsType(item, type)) {
      return 'qualified';
    }

    // Training Evolution (Quartermaster's Guide p.31): "you count as Trained and Specialized with
    // that item" for the mission.
    const evolution = activeEvolution(actor);
    if (evolution?.kind == 'weapon' && matchesChosen(item, evolution)) {
      return 'trained';
    }
  }

  // The Promise of Riches (Intercontinental Adventures p.103): "you are Trained with Limited
  // weapons and Limited battledress."
  if (has(actor, Q2.promiseOfRiches) && atMost(availability, 'limited')) {
    return 'trained';
  }

  return null;
}

const ACCESS_ORDER = ['none', 'unknown', 'trained', 'qualified'];

export function onRequisitionAccess(actor, item, out) {
  const extra = perkAccess(actor, item);
  if (extra && ACCESS_ORDER.indexOf(extra) > ACCESS_ORDER.indexOf(out.access ?? 'unknown')) {
    out.access = extra;
  }
}

/**
 * Upgrades this actor is Qualified in: Oorah!'s "silent battledress upgrade", Upgrade Training's
 * (Intercontinental Adventures p.95) "three new Limited weapon upgrades or one Restricted weapon
 * upgrade".
 */
export function isQualifiedUpgrade(actor, upgrade) {
  const source = sourceOf(upgrade) ?? upgrade?.uuid;
  if (has(actor, Q2.oorah) && (source == SILENT_BATTLEDRESS || (upgrade?.type == 'upgrade' && norm(upgrade?.name) == 'silent' && upgrade?.system?.type == 'armor'))) {
    return true;
  }

  const training = itemOf(actor, Q2.upgradeTraining);
  return !!training && chosenOn(training).some(chosen => matchesChosen(upgrade, chosen));
}

function attachedUpgrades(item) {
  const owned = item?.parent ? itemsOf(item.parent).filter(other => other.type == 'upgrade' && other.flags?.essence20?.parentId == item.id) : [];
  if (owned.length) {
    return owned;
  }

  return Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'upgrade');
}

function combine(tierA, tierB) {
  if (tierA == 'theoretical' || tierB == 'theoretical') {
    return 'theoretical';
  }

  const plain = tier => (tier == 'automatic' ? 'standard' : tier);
  return CONFIG.E20?.upgradeAvailabilityMatrix?.[plain(tierA)]?.[plain(tierB)]
    ?? (tierRank(tierA) >= tierRank(tierB) ? tierA : tierB);
}

/** The item's Availability once the upgrades this actor is Qualified in are left out of the stacking. */
export function effectiveAvailability(actor, item) {
  const base = item?.system?.availability ?? 'standard';
  const total = item?.system?.totalAvailability ?? base;
  const upgrades = attachedUpgrades(item);
  const kept = upgrades.filter(upgrade => !isQualifiedUpgrade(actor, upgrade));
  if (kept.length == upgrades.length) {
    return total;
  }

  const tierOf = upgrade => upgrade.system?.availability ?? upgrade.availability ?? 'standard';
  const all = upgrades.reduce((tier, upgrade) => combine(tier, tierOf(upgrade)), base);
  const adjusted = kept.reduce((tier, upgrade) => combine(tier, tierOf(upgrade)), base);
  // Any other step already folded into totalAvailability is carried over.
  const steps = tierRank(total) - tierRank(all);
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, tierRank(adjusted) + steps))] ?? adjusted;
}

export function onRequisitionAvailability(actor, item, out) {
  const tier = effectiveAvailability(actor, item);
  if (tierRank(tier) >= 0 && tierRank(tier) < tierRank(out.availability ?? 'standard')) {
    out.availability = tier;
  }
}

/* -------------------------------------------- */
/*  Whisper Warrior - Defend as a Free action    */
/* -------------------------------------------- */

// "while wielding a weapon with the Martial Arts and Silent traits, you can Defend as a Free action."
export function wieldsSilentMartialArts(actor) {
  return itemsOf(actor).some(item => item.type == 'weapon' && item.system?.equipped !== false && isSilentMartialArts(item));
}

export const WHISPER_WARRIOR_RULE = {
  id: 'q2WhisperWarrior',
  label: 'Whisper Warrior',
  has: actor => has(actor, Q2.whisperWarrior) && wieldsSilentMartialArts(actor),
  matches: ctx => ctx?.key == 'defend',
  to: () => 'free',
};

/* -------------------------------------------- */
/*  Training Evolution                           */
/* -------------------------------------------- */

// "At the start of a mission, select one weapon or vehicle that an allied character is both Trained
// and Specialized in. For the duration of the mission, you count as Trained and Specialized with that
// item." Kept on the Perk, stamped with the mission it was chosen in.
export function activeEvolution(actor) {
  const record = itemOf(actor, Q2.trainingEvolution)?.flags?.essence20?.[EVOLUTION_FLAG];
  return record && record.mission === getMissionEpoch() ? record : null;
}

function crews(actor, vehicleUuid) {
  const vehicle = worldActors().find(candidate => candidate.uuid == vehicleUuid);
  return !!vehicle && Object.values(vehicle.system?.actors ?? {}).some(crew => crew?.uuid == actor?.uuid);
}

export function evolutionSpecializes(actor, skill, item) {
  const evolution = activeEvolution(actor);
  if (!evolution) {
    return false;
  }

  if (evolution.kind == 'weapon' && item?.type == 'weaponEffect') {
    const weapon = parentWeapon(actor, item);
    return !!weapon && matchesChosen(weapon, evolution);
  }

  return evolution.kind == 'vehicle' && skill == 'driving' && crews(actor, evolution.uuid);
}

async function chooseEvolution(perk) {
  const actor = perk.parent;
  const { chooseSelect } = await import("../../grants.mjs");
  const allies = worldActors().filter(other => other.id != actor.id && other.type == 'playerCharacter');
  const allyId = await chooseSelect(perk.name, T('E20.Q2EvolutionAlly'), allies.map(ally => ({ value: ally.id, label: ally.name })));
  const ally = allies.find(other => other.id == allyId);
  if (!ally) {
    return null;
  }

  // Their weapons, and the vehicles they crew.
  const options = itemsOf(ally).filter(item => item.type == 'weapon')
    .map(weapon => ({ value: `weapon:${weapon.id}`, label: weapon.name }));
  for (const vehicle of worldActors().filter(other => ['vehicle', 'zord'].includes(other.type))) {
    if (Object.values(vehicle.system?.actors ?? {}).some(crew => crew?.uuid == ally.uuid)) {
      options.push({ value: `vehicle:${vehicle.uuid}`, label: vehicle.name });
    }
  }

  const choice = await chooseSelect(perk.name, T('E20.Q2EvolutionItem', { ally: ally.name }), options);
  if (!choice) {
    return null;
  }

  const [kind, ref] = choice.split(/:(.+)/);
  const picked = kind == 'weapon' ? ally.items.get(ref) : worldActors().find(v => v.uuid == ref);
  const record = { kind, uuid: kind == 'weapon' ? (sourceOf(picked) ?? picked?.uuid) : ref, name: picked?.name ?? '', ally: ally.name, mission: getMissionEpoch() };
  await perk.setFlag('essence20', EVOLUTION_FLAG, record);
  return T('E20.Q2EvolutionChosen', { name: actor.name, item: record.name, ally: ally.name });
}

/* -------------------------------------------- */
/*  Mentor - one Skill, one more Essence         */
/* -------------------------------------------- */

// Mentor (Transformers CRB, General Perk, p.110): "Choose a Skill. You can associate that Skill with
// an additional Essence." The same system.skills.<skill>.essences.<essence> flag the Skill Picker's
// multi-Essence spend already reads (helpers/skill-picker.mjs#getSkillEssences), set from the choice
// on the Perk each time derived data is prepared.
export function applyMentor(actor) {
  const choice = itemOf(actor, Q2.mentor)?.flags?.essence20?.[MENTOR_FLAG];
  const skill = choice ? actor.system?.skills?.[choice.skill] : null;
  if (skill?.essences && choice.essence in skill.essences) {
    skill.essences[choice.essence] = true;
  }
}

async function chooseMentor(perk) {
  const { chooseSelect } = await import("../../grants.mjs");
  const skills = Object.entries(CONFIG.E20.skills ?? {}).map(([value, label]) => ({ value, label: T(label) }));
  const skill = await chooseSelect(perk.name, T('E20.Q2MentorSkill'), skills);
  if (!skill) {
    return null;
  }

  const own = CONFIG.E20.skillToEssence?.[skill];
  const essences = Object.entries(CONFIG.E20.originEssences ?? CONFIG.E20.essences ?? {})
    .filter(([key]) => key != own).map(([value, label]) => ({ value, label: T(label) }));
  const essence = await chooseSelect(perk.name, T('E20.Q2MentorEssence'), essences);
  if (!essence) {
    return null;
  }

  await perk.setFlag('essence20', MENTOR_FLAG, { skill, essence });
  return T('E20.Q2MentorChosen', { name: perk.parent.name, skill: T(CONFIG.E20.skills[skill]), essence: T(CONFIG.E20.originEssences?.[essence] ?? essence) });
}

/* -------------------------------------------- */
/*  Weapon Enthusiast                            */
/* -------------------------------------------- */

async function chooseEnthusiastType(perk) {
  const { chooseSelect } = await import("../../grants.mjs");
  const type = await chooseSelect(perk.name, T('E20.Q2EnthusiastType'),
    Object.entries(CONFIG.E20.weaponTypes ?? {}).map(([value, label]) => ({ value, label: T(label) })));
  if (!type) {
    return null;
  }

  await perk.setFlag('essence20', TYPE_FLAG, type);
  // The Influence's Hang-Up reads the same choice.
  const hangUp = itemOf(perk.parent, Q2.weaponEnthusiastHangUp);
  if (hangUp) {
    await hangUp.setFlag('essence20', TYPE_FLAG, type);
  }

  return T('E20.Q2EnthusiastTypeChosen', { name: perk.parent.name, type: T(CONFIG.E20.weaponTypes[type]) });
}

async function enthusiastUse(perk) {
  const actor = perk.parent;
  const type = enthusiastType(actor);
  if (!type) {
    return chooseEnthusiastType(perk);
  }

  const { chooseButtons, chooseSelect, pickAndGrant } = await import("../../grants.mjs");
  const which = await chooseButtons(perk.name, T('E20.Q2EnthusiastWhich', { type: T(CONFIG.E20.weaponTypes[type]) }), [
    ['take', T('E20.Q2TakeQualified')], ['tag', T('E20.Q2EnthusiastTag')], ['type', T('E20.Q2EnthusiastChange')],
  ]);
  if (which == 'type') {
    return chooseEnthusiastType(perk);
  }

  if (which == 'tag') {
    const weaponId = await chooseSelect(perk.name, T('E20.Q2EnthusiastTagPrompt'),
      itemsOf(actor).filter(item => item.type == 'weapon').map(weapon => ({ value: weapon.id, label: weapon.name })));
    const weapon = weaponId ? actor.items.get(weaponId) : null;
    if (!weapon) {
      return null;
    }

    await weapon.setFlag('essence20', TYPE_FLAG, type);
    return T('E20.Q2EnthusiastTagged', { weapon: weapon.name, type: T(CONFIG.E20.weaponTypes[type]) });
  }

  if (which != 'take') {
    return null;
  }

  const got = await pickAndGrant(actor, perk, perk.name, {
    type: 'weapon', availabilities: ['standard', 'limited'], matches: entry => weaponIsType(entry, type),
  }, { flags: { qualified: true, [TYPE_FLAG]: type } });
  return got ? T('E20.Q2TookQualified', { name: actor.name, item: got.name }) : null;
}

/**
 * Weapon Enthusiast's Hang-Up: "You cannot benefit from Lend Assistance when using weapons of the type
 * gained from this Influence's Perk." Lend Assistance is a bonus banked on the assisted actor
 * (helpers/lend-assistance.mjs); for an attack with such a weapon it's set aside before the roll reads
 * it, and put back afterwards for the next roll that can use it.
 */
const ASSIST_FLAGS = ['pendingLendAssistanceShift', 'pendingLendAssistanceEdge'];
const heldAssist = new Map();

export function enthusiastBlocks(actor, item) {
  if (!has(actor, Q2.weaponEnthusiastHangUp) || item?.type != 'weaponEffect') {
    return false;
  }

  const weapon = parentWeapon(actor, item);
  return !!weapon && weaponIsType(weapon, enthusiastType(actor));
}

async function restoreAssist(actor) {
  const held = heldAssist.get(actor?.id);
  if (!held) {
    return;
  }

  heldAssist.delete(actor.id);
  for (const [key, value] of Object.entries(held)) {
    if (!actor.getFlag?.('essence20', key)) {
      await actor.setFlag('essence20', key, value);
    }
  }
}

export async function enthusiastPreRoll(actor, dataset, item) {
  await restoreAssist(actor);
  if (!enthusiastBlocks(actor, item)) {
    return;
  }

  const held = {};
  for (const key of ASSIST_FLAGS) {
    const value = actor.getFlag?.('essence20', key);
    if (value) {
      held[key] = value;
      await actor.unsetFlag('essence20', key);
    }
  }

  if (Object.keys(held).length) {
    heldAssist.set(actor.id, held);
    ui.notifications?.info(T('E20.Q2EnthusiastNoAssist', { name: actor.name }));
  }
}

/* -------------------------------------------- */
/*  Trade School - the whole scene               */
/* -------------------------------------------- */

// Trade School (Quartermaster's Guide p.22): "an ally of your choice can use your Technology Skill and
// Specialization dice in place of their own for the duration of one scene." Its Use button
// (helpers/banked-buffs.mjs / trade-school.mjs) banks `pendingTradeSchool` on the ally, which the
// ally's next Technology roll consumes. The first time that roll happens this records the grant for
// the rest of the scene, and every Technology roll that scene rolls the coach's die - and counts as
// Specialized when the coach is Specialized in Technology.
export function tradeSchoolCoach(actor) {
  const record = actor?.getFlag?.('essence20', TRADE_SCHOOL_FLAG);
  if (!record || record.scene !== getSceneEpoch()) {
    return null;
  }

  return worldActors().find(other => other.id == record.granterId) ?? null;
}

export async function tradeSchoolPreRoll(actor, dataset) {
  if (dataset?.skill != 'technology') {
    return;
  }

  const pending = actor.getFlag?.('essence20', 'pendingTradeSchool');
  if (pending?.granterId && actor.getFlag?.('essence20', TRADE_SCHOOL_FLAG)?.scene !== getSceneEpoch()) {
    await actor.setFlag('essence20', TRADE_SCHOOL_FLAG, { granterId: pending.granterId, scene: getSceneEpoch() });
  }

  const coach = tradeSchoolCoach(actor);
  const coachShift = coach?.system?.skills?.technology?.shift;
  const list = CONFIG.E20.skillShiftList ?? [];
  const mine = dataset.shift || actor.system?.skills?.technology?.shift || 'd20';
  if (coachShift && list.indexOf(coachShift) >= 0 && (list.indexOf(mine) < 0 || list.indexOf(coachShift) < list.indexOf(mine))) {
    dataset.shift = coachShift;
  }
}

export function tradeSchoolSpecializes(actor, skill) {
  if (skill != 'technology') {
    return false;
  }

  const tech = tradeSchoolCoach(actor)?.system?.skills?.technology;
  return !!tech && (!!tech.isSpecialized || Object.keys(tech.specializations ?? {}).length > 0);
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function takeQualified(perk, filter, extraFlags = {}) {
  const { pickAndGrant } = await import("../../grants.mjs");
  const got = await pickAndGrant(perk.parent, perk, perk.name, filter, { flags: { qualified: true, ...extraFlags } });
  return got ? T('E20.Q2TookQualified', { name: perk.parent.name, item: got.name }) : null;
}

// Upgrade Training: "You are qualified in three new Limited weapon upgrades or one Restricted weapon
// upgrade." Picked once, kept on the Perk (for Requisition) and taken as gear.
async function upgradeTrainingUse(perk) {
  if (chosenOn(perk).length) {
    ui.notifications.warn(T('E20.Q2AlreadyChosen', { perk: perk.name, items: chosenOn(perk).map(c => c.name).join(', ') }));
    return null;
  }

  const { chooseButtons, findItems, grantCopy, pickOne } = await import("../../grants.mjs");
  const tier = await chooseButtons(perk.name, T('E20.Q2UpgradeTrainingPrompt'), [['limited', T('E20.Q2ThreeLimited')], ['restricted', T('E20.Q2OneRestricted')]]);
  if (!tier) {
    return null;
  }

  const rows = await findItems({ type: 'upgrade', availabilities: [tier], matches: entry => entry.system?.type == 'weapon' });
  const chosen = [];
  for (let i = 0; i < (tier == 'limited' ? 3 : 1); i++) {
    const uuid = await pickOne(perk.name, rows.filter(row => !chosen.some(c => c.uuid == row.uuid)));
    if (!uuid) {
      break;
    }

    const copy = await grantCopy(perk.parent, uuid, { grantedBy: perk, flags: { qualified: true } });
    chosen.push({ uuid, name: copy?.name ?? rows.find(row => row.uuid == uuid)?.name ?? '' });
  }

  if (!chosen.length) {
    return null;
  }

  await perk.setFlag('essence20', CHOSEN_FLAG, chosen);
  return T('E20.Q2TookQualified', { name: perk.parent.name, item: chosen.map(c => c.name).join(', ') });
}

async function oorahUse(perk) {
  const { chooseButtons, grantCopy } = await import("../../grants.mjs");
  const which = await chooseButtons(perk.name, T('E20.Q2OorahPrompt'), [['weapon', T('E20.Q2StandardWeapon')], ['silent', T('E20.Q2SilentUpgrade')]]);
  if (which == 'silent') {
    const got = await grantCopy(perk.parent, SILENT_BATTLEDRESS, { grantedBy: perk, flags: { qualified: true } });
    return got ? T('E20.Q2TookQualified', { name: perk.parent.name, item: got.name }) : null;
  }

  return which == 'weapon' ? takeQualified(perk, { type: 'weapon', availabilities: ['standard'] }) : null;
}

const USES = {
  [Q2.upgradeTraining]: upgradeTrainingUse,
  [Q2.oorah]: oorahUse,
  [Q2.whisperWarrior]: perk => takeQualified(perk, { type: 'weapon', matches: isSilentMartialArts }),
  [Q2.hardwareTraining]: perk => takeQualified(perk, { type: 'weapon', availabilities: ['standard', 'limited', 'restricted'], matches: isHardwareWeapon }),
  [Q2.weaponEnthusiast]: enthusiastUse,
  [Q2.trainingEvolution]: chooseEvolution,
  [Q2.mentor]: chooseMentor,
};

export const QUALIFY2_USE = {
  id: 'q2Qualify',
  matches: item => item?.type == 'perk' && !!USES[sourceOf(item)],
  canUse: () => true,
  async run(item) {
    const fn = USES[sourceOf(item)];
    return fn ? fn(item) : null;
  },
};

export function registerQualifications() {
  registerUse(QUALIFY2_USE);
  registerCostRule(WHISPER_WARRIOR_RULE);
  registerDerived(applyMentor);
  registerSpecializes((actor, skill, item) => evolutionSpecializes(actor, skill, item) || tradeSchoolSpecializes(actor, skill));
  registerPreRoll(async (actor, dataset, item) => {
    await enthusiastPreRoll(actor, dataset, item);
    await tradeSchoolPreRoll(actor, dataset);
  });
  registerPostRoll(actor => restoreAssist(actor));
  if (globalThis.Hooks?.on) {
    Hooks.on('essence20.requisitionAccess', onRequisitionAccess);
    Hooks.on('essence20.requisitionAvailability', onRequisitionAvailability);
  }
}

registerQualifications();
