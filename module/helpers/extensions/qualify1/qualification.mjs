import { registerApplyDialog, registerRollSources, registerUse } from "../../extensions.mjs";
import { has, idOf, itemFrom, itemsFrom, Q1, Q1_UPGRADE, SILENCER_UUID, sourceOf, T } from "./common.mjs";

/**
 * Equipment Training and Qualification from Perks - "In addition to your Role's Equipment Training
 * and Qualifications, you are Qualified in..." (G.I. Joe CRB p.72/80: "You can requisition any
 * battledress and weapons you are trained in ... You can access any equipment you are Qualified in
 * without requisitioning it").
 *
 * What it does in this system is Requisition (helpers/requisition.mjs): a Qualified item is taken
 * with no Skill Test and no attempt spent. A weapon carries no weapon-type field, so the Role
 * training booleans can't be matched to one - but the Perks here are phrased by Availability tier
 * ("all Standard weapons"), by trait ("weapons with the Injection trait"), or by a chosen item ("a
 * Limited or Restricted weapon of your choice"), all of which a weapon does carry. requisition.mjs
 * asks these rules through two hooks (see the qualify1 patch spec):
 *
 *   essence20.requisitionAccess (actor, item, out)       out.access: 'qualified'|'trained'|'none'|'unknown'
 *   essence20.requisitionAvailability (actor, item, out) out.availability: the tier the DIF is read from
 *
 * The second is for upgrade Qualification ("Qualified in Microtech Weapon and Microtech Armor
 * upgrades"): an upgrade you're Qualified in is simply fitted, so it no longer raises the combined
 * Availability (Table 8-2) the Requisition Test is rolled against.
 */

const TIERS = ['automatic', 'standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical', 'other'];
const tierRank = tier => TIERS.indexOf(tier);
const CHOSEN_FLAG = 'q1Chosen';

/* -------------------------------------------- */
/*  Rules                                        */
/* -------------------------------------------- */

// "Qualified in all Standard weapons": Standard Weapon Training (Field Guide p.72), The Glory of
// Cobra-La (Ferocious Fighters p.73), Ultra-Secret Strike Force (p.42), Nu, Pogodi! (Intercontinental
// Adventures p.68).
const STANDARD_WEAPON_QUALIFIERS = [Q1.standardWeaponTraining, Q1.gloryOfCobraLa, Q1.ultraSecretStrikeForce, Q1.nuPogodi];

// Upgrade Qualifications.
// Minimalists (Cobra Codex p.74): "You are Qualified in Microtech Weapon and Microtech Armor upgrades."
// Mega Training Regimen (Ferocious Fighters p.74): "Qualified in ... the Organic battledress upgrade."
// Roaming the Land (p.75): "Qualified with the Traumatic weapon upgrade."
// Surgical Operators (p.72): "the Anti-V.E.N.O.M. weapon upgrade, and the Rebreather battledress upgrade."
// The Glory of Cobra-La (p.73): "the Organic Armor battledress upgrade and Biomechanical weapon upgrade."
// Ultra-Secret Strike Force (p.42): "the Pythonized Battledress upgrade."
// Nu, Pogodi! (Intercontinental Adventures p.68): "the Acclimating battledress upgrade."
// Rebreather has no compendium item, so upgrades also match by name.
const UPGRADE_QUALIFIERS = [
  [Q1.minimalists, [Q1_UPGRADE.microtechWeapon, Q1_UPGRADE.microtechBattledress], ['microtech weapon', 'microtech battledress', 'microtech armor']],
  [Q1.megaTrainingRegimen, [Q1_UPGRADE.organicArmor], ['organic armor']],
  [Q1.roamingTheLand, [Q1_UPGRADE.traumatic], ['traumatic']],
  [Q1.surgicalOperators, [Q1_UPGRADE.antiVenom], ['anti-v.e.n.o.m.', 'rebreather']],
  [Q1.gloryOfCobraLa, [Q1_UPGRADE.organicArmor, Q1_UPGRADE.biomechanicalWeapon], ['organic armor', 'biomechanical weapon']],
  [Q1.ultraSecretStrikeForce, [Q1_UPGRADE.pythonized], ['pythonized']],
  [Q1.nuPogodi, [Q1_UPGRADE.acclimating], ['acclimating']],
];

const norm = name => String(name ?? '').trim().toLowerCase();

/**
 * Whether the actor is Qualified in this upgrade (an attached entry or an upgrade Item).
 * @param {Actor} actor
 * @param {{uuid?: String, name?: String}|Item} upgrade
 */
export function isQualifiedUpgrade(actor, upgrade) {
  const id = idOf(sourceOf(upgrade) ?? upgrade?.uuid);
  const name = norm(upgrade?.name);
  return UPGRADE_QUALIFIERS.some(([perk, ids, names]) => has(actor, perk)
    && (ids.includes(id) || names.includes(name)));
}

/** The upgrades attached to a weapon or armor - owned upgrade Items, else the item's own entries. */
function attachedUpgrades(item) {
  const owned = item?.parent?.items?.filter
    ? item.parent.items.filter(other => other.type == 'upgrade' && other.flags?.essence20?.parentId == item.id)
    : [];
  if (owned.length) {
    return owned.map(upgrade => ({ uuid: sourceOf(upgrade) ?? upgrade.uuid, name: upgrade.name, availability: upgrade.system?.availability }));
  }

  return Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'upgrade');
}

function combine(tierA, tierB) {
  if (tierA == 'theoretical' || tierB == 'theoretical') {
    return 'theoretical';
  }

  const normalize = tier => (tier == 'automatic' ? 'standard' : tier);
  const combined = CONFIG.E20?.upgradeAvailabilityMatrix?.[normalize(tierA)]?.[normalize(tierB)];
  if (combined) {
    return combined;
  }

  return tierRank(tierA) >= tierRank(tierB) ? tierA : tierB;
}

function step(tier, steps) {
  const rank = tierRank(tier);
  if (rank < 0 || !steps) {
    return tier;
  }

  return TIERS[Math.max(0, Math.min(TIERS.length - 1, rank + steps))];
}

/**
 * The Availability an item is requisitioned at, once the upgrades this actor is Qualified in are
 * left out of Table 8-2's stacking. Any other adjustment already folded into totalAvailability
 * (Fieldtest's one step) is carried over as the same number of steps.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {String}
 */
export function effectiveAvailability(actor, item) {
  const base = item?.system?.availability ?? 'standard';
  const total = item?.system?.totalAvailability ?? base;
  const upgrades = attachedUpgrades(item);
  const kept = upgrades.filter(upgrade => !isQualifiedUpgrade(actor, upgrade));
  if (kept.length == upgrades.length) {
    return total;
  }

  const all = upgrades.reduce((tier, upgrade) => combine(tier, upgrade.availability ?? 'standard'), base);
  const adjusted = kept.reduce((tier, upgrade) => combine(tier, upgrade.availability ?? 'standard'), base);
  return step(adjusted, tierRank(total) - tierRank(all));
}

/** A weapon's traits, as prepared (totalTraits) or stored. */
function traitsOf(item) {
  const traits = item?.system?.totalTraits ?? item?.system?.traits ?? [];
  return Array.isArray(traits) ? traits : Object.keys(traits).filter(key => traits[key]);
}

/** The item as chosen on a Perk: by compendium source, uuid, or name. */
function matchesChosen(item, chosen) {
  const source = sourceOf(item) ?? item?.uuid;
  return (chosen.uuid && (chosen.uuid == source || chosen.uuid == item?.uuid))
    || (chosen.name && norm(chosen.name) == norm(item?.name));
}

export function chosenOn(perk) {
  return perk?.flags?.essence20?.[CHOSEN_FLAG] ?? [];
}

// Chosen-item Qualifications (Qualified) and training (Trained).
const CHOSEN_QUALIFIED = [Q1.tradeGoods, Q1.forTheSyndicate, Q1.goodToGo, Q1.ninpoJoes, Q1.nuPogodi];
const CHOSEN_TRAINED = [Q1.service];

// "Energized close combat weapons" (Roaming the Land) - a melee weapon with an energy/element trait.
const ENERGIZED_TRAITS = ['energy', 'electric', 'laser', 'fire', 'ice', 'plasma', 'element', 'sonic', 'radiant'];

function isMeleeWeapon(item) {
  const effects = item?.parent?.items?.filter
    ? item.parent.items.filter(other => other.type == 'weaponEffect' && other.flags?.essence20?.parentId == item.id).map(effect => effect.system)
    : Object.values(item?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
  return effects.some(effect => effect?.classification?.style == 'melee' || effect?.range?.reachMultiplier > 0);
}

/**
 * What these Perks add to an actor's access to a weapon or armor.
 * @param {Actor} actor
 * @param {Item} item   A weapon or armor.
 * @returns {?'qualified'|'trained'}
 */
export function perkAccess(actor, item) {
  if (!actor || !['weapon', 'armor'].includes(item?.type)) {
    return null;
  }

  const availability = effectiveAvailability(actor, item);

  for (const uuid of CHOSEN_QUALIFIED) {
    if (itemsFrom(actor, uuid).some(perk => chosenOn(perk).some(chosen => matchesChosen(item, chosen)))) {
      return 'qualified';
    }
  }

  if (item.type == 'weapon') {
    if (tierRank(availability) <= tierRank('standard') && STANDARD_WEAPON_QUALIFIERS.some(uuid => has(actor, uuid))) {
      return 'qualified';
    }

    // Surgical Operators: "Qualified in all weapons with the Injection trait".
    if (traitsOf(item).includes('injection') && has(actor, Q1.surgicalOperators)) {
      return 'qualified';
    }
  }

  if (item.type == 'armor') {
    // Mega Training Regimen: "Qualified in Computerized armor".
    if (traitsOf(item).includes('computerized') && has(actor, Q1.megaTrainingRegimen)) {
      return 'qualified';
    }

    // "You are Trained in all armor."
    if (has(actor, Q1.megaTrainingRegimen)) {
      return 'trained';
    }
  }

  for (const uuid of CHOSEN_TRAINED) {
    if (itemsFrom(actor, uuid).some(perk => chosenOn(perk).some(chosen => matchesChosen(item, chosen)))) {
      return 'trained';
    }
  }

  if (item.type == 'weapon') {
    // If It Shoots... (G.I. Joe CRB p.53): "You are trained in all weapons, other than unique weapons."
    if (has(actor, Q1.ifItShoots) && (item.system?.availability ?? 'standard') != 'unique') {
      return 'trained';
    }

    // Roaming the Land: "trained in energized close combat weapons".
    if (has(actor, Q1.roamingTheLand) && isMeleeWeapon(item) && traitsOf(item).some(trait => ENERGIZED_TRAITS.includes(trait))) {
      return 'trained';
    }
  }

  return null;
}

const ACCESS_ORDER = ['none', 'unknown', 'trained', 'qualified'];

/** Hook body: only ever widens access. */
export function onRequisitionAccess(actor, item, out) {
  const extra = perkAccess(actor, item);
  if (extra && ACCESS_ORDER.indexOf(extra) > ACCESS_ORDER.indexOf(out.access ?? 'unknown')) {
    out.access = extra;
  }
}

export function onRequisitionAvailability(actor, item, out) {
  const tier = effectiveAvailability(actor, item);
  if (tierRank(tier) >= 0 && tierRank(tier) < tierRank(out.availability ?? 'standard')) {
    out.availability = tier;
  }
}

/* -------------------------------------------- */
/*  Good To Go - Kit prerequisites               */
/* -------------------------------------------- */

/**
 * Good To Go (Intercontinental Adventures p.101): "When Requisitioning Kits, treat the
 * Prerequisites as one Rank lower. For example, you only need +d2 in a Skill to Requisition a
 * Standard Kit, +d4 to Requisition a Limited Kit, and +d6 to Requisition a Restricted Kit."
 * Hook essence20.kitPrerequisite (actor, info, out) - out.need is the shift required.
 */
export function onKitPrerequisite(actor, info, out) {
  if (!has(actor, Q1.goodToGo) || !out?.need) {
    return;
  }

  const list = CONFIG.E20?.skillShiftList ?? [];
  const index = list.indexOf(out.need);
  // skillShiftList runs from the biggest die down; one Rank lower is one step further along it,
  // never past d2.
  const d2 = list.indexOf('d2');
  if (index >= 0 && (d2 < 0 || index < d2)) {
    out.need = list[index + 1];
  }
}

/* -------------------------------------------- */
/*  Vehicle Qualifications                       */
/* -------------------------------------------- */

const SIZES = ['small', 'common', 'large', 'long', 'huge', 'extended', 'gigantic', 'extended2', 'towering', 'extended3', 'titanic'];
const isLand = vehicle => (vehicle?.system?.movement?.ground?.base ?? 0) > 0;

/**
 * The faction Perks' "Qualified with [vehicles] and roll Driving Skill Tests to drive [them] without
 * Snag even if you have no Ranks in the Driving skill."
 * - Mega Training Regimen: "Huge and larger land vehicles".
 * - Spared No Expense: "Large/Long and smaller Land vehicles".
 * - Surgical Operators: "vehicles that can carry passengers".
 * - Ultra-Secret Strike Force: "Python Patrol vehicles ... any Pythonized air, land, or sea vehicles"
 *   (a vehicle wearing Python Paint, or named for the Python Patrol).
 * The Glory of Cobra-La's "vehicles with the Biomechanical trait" has no vehicle trait to read.
 * @returns {?String} the Perk uuid that qualifies, if any.
 */
export function vehicleQualifier(actor, vehicle) {
  if (!vehicle) {
    return null;
  }

  const size = SIZES.indexOf(vehicle.system?.size ?? 'common');
  const rules = [
    [Q1.megaTrainingRegimen, () => isLand(vehicle) && size >= SIZES.indexOf('huge')],
    [Q1.sparedNoExpense, () => isLand(vehicle) && size >= 0 && size <= SIZES.indexOf('long')],
    [Q1.surgicalOperators, () => (vehicle.system?.crew?.numPassengers ?? 0) > 0],
    [Q1.ultraSecretStrikeForce, () => !!vehicle.system?.traits?.pythonPaint || /python/i.test(vehicle.name ?? '')],
    // The Glory of Cobra-La: "You are Qualified with vehicles with the Biomechanical trait."
    [Q1.gloryOfCobraLa, () => isBiomechanicalVehicle(vehicle)],
  ];
  return rules.find(([uuid, test]) => has(actor, uuid) && test())?.[0] ?? null;
}

function drivenVehicle(actor) {
  return actor?._dice?._getPilotedVehicle?.(actor, 'driver') ?? null;
}

const skillRanked = (actor, skill) => (actor?.system?.skills?.[skill]?.shift ?? 'd20') != 'd20';

/** Is this weapon effect part of a vehicle's weapon systems, or an Integrated hardpoint weapon? */
function isVehicleOrHardpointWeapon(effect) {
  const parent = effect?.parent;
  if (['vehicle', 'zord'].includes(parent?.type)) {
    return true;
  }

  const weaponId = effect?.flags?.essence20?.parentId;
  const weapon = weaponId ? parent?.items?.get?.(weaponId) : null;
  return weapon?.system?.hardpoint?.type == 'integrated';
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

const BIOMECHANICAL_NAME = /bio-?mech|cobra-la/i;

/** A Biomechanical vehicle: the trait ticked on it, or a Cobra-La name. */
export function isBiomechanicalVehicle(vehicle) {
  return !!vehicle?.system?.traits?.biomechanical || BIOMECHANICAL_NAME.test(vehicle?.name ?? '');
}

/**
 * Biomechanical battledress: the Organic Armor upgrade attached ("the Organic Armor battledress
 * upgrade" is Cobra-La's Biomechanical battledress), or a Cobra-La name.
 */
export function isBiomechanicalArmor(armor) {
  const owner = armor?.parent;
  const upgrades = owner?.items?.filter?.(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == armor.id) ?? [];
  return BIOMECHANICAL_NAME.test(armor?.name ?? '')
    || upgrades.some(upgrade => idOf(sourceOf(upgrade)) == Q1_UPGRADE.organicArmor || /organic armor/i.test(upgrade.name ?? ''));
}

/** Equipped battledress that isn't Biomechanical. */
export function nonBiomechanicalArmorWorn(actor) {
  const items = actor?.items?.contents ?? [...(actor?.items ?? [])];
  return items.find(item => item.type == 'armor' && item.system?.equipped && !isBiomechanicalArmor(item)) ?? null;
}

function isBiomechanicalWeapon(effect) {
  const parent = effect?.parent;
  const weaponId = effect?.flags?.essence20?.parentId;
  const weapon = weaponId ? parent?.items?.get?.(weaponId) : null;
  if (!weapon) {
    return true; // unarmed / natural attacks aren't gear
  }

  return BIOMECHANICAL_NAME.test(weapon.name ?? '')
    || traitsOf(weapon).includes('biomechanical')
    || (parent?.items?.filter?.(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weapon.id) ?? [])
      .some(upgrade => idOf(sourceOf(upgrade)) == Q1_UPGRADE.biomechanicalWeapon);
}

export function qualificationSources(actor, target, ctx = {}) {
  const sources = [];
  const perkName = uuid => itemFrom(actor, uuid)?.name ?? '';

  if (ctx.rolledSkill == 'driving') {
    const vehicle = drivenVehicle(actor);
    const qualifier = vehicleQualifier(actor, vehicle);
    // The ↑1 every other Vehicle Qualification in this system gives a driver with Ranks
    // (dice.mjs VEHICLE_QUALIFICATION_PERKS_BY_MOVEMENT_TYPE).
    if (qualifier && skillRanked(actor, 'driving')) {
      sources.push({ id: 'q1VehicleQual', label: perkName(qualifier), shiftUp: 1 });
    }

    // The Glory of Cobra-La: "You suffer Snag when you use ... vehicles ... that do not have the
    // Biomechanical trait."
    if (vehicle && has(actor, Q1.gloryOfCobraLa) && !isBiomechanicalVehicle(vehicle)) {
      sources.push({ id: 'q1CobraLaVehicle', label: perkName(Q1.gloryOfCobraLa), snag: true });
    }
  }

  if (ctx.isAttack && ctx.item?.type == 'weaponEffect') {
    // Mega Training Regimen: "You gain ↑1 when using vehicle weapon systems and hardpoint weapons."
    if (has(actor, Q1.megaTrainingRegimen) && isVehicleOrHardpointWeapon(ctx.item)) {
      sources.push({ id: 'q1MegaVehicleWeapon', label: perkName(Q1.megaTrainingRegimen), shiftUp: 1 });
    }

    // The Glory of Cobra-La: Snag with weapons that do not have the Biomechanical trait.
    if (has(actor, Q1.gloryOfCobraLa) && !isBiomechanicalWeapon(ctx.item)) {
      sources.push({ id: 'q1CobraLaWeapon', label: perkName(Q1.gloryOfCobraLa), snag: true });
    }
  }

  // The Glory of Cobra-La: "You suffer Snag when you use battledress ... that do not have the
  // Biomechanical trait" - read as every Skill Test made while wearing it.
  if (has(actor, Q1.gloryOfCobraLa)) {
    const worn = nonBiomechanicalArmorWorn(actor);
    if (worn) {
      sources.push({ id: 'q1CobraLaArmor', label: `${perkName(Q1.gloryOfCobraLa)} (${worn.name})`, snag: true });
    }
  }

  return { sources, consumes: [] };
}

/**
 * The "without Snag even if you have no Ranks in the Driving skill" half: the untrained-Snag
 * default the dialog opened with is lifted for a qualified vehicle.
 */
export function qualificationApplyDialog(actor, options, ctx = {}) {
  if (ctx.rolledSkill != 'driving' || skillRanked(actor, 'driving') || !options.snag) {
    return;
  }

  // Never lifts The Glory of Cobra-La's own Snag for a vehicle that isn't Biomechanical.
  const vehicle = drivenVehicle(actor);
  if (vehicleQualifier(actor, vehicle) && !(has(actor, Q1.gloryOfCobraLa) && !isBiomechanicalVehicle(vehicle))) {
    options.snag = false;
  }
}

/* -------------------------------------------- */
/*  Choosing the item                            */
/* -------------------------------------------- */

const effectsOfEntry = entry => Object.values(entry.system?.items ?? {}).filter(e => e?.type == 'weaponEffect');
const isMeleeEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style == 'melee' || e.range?.reachMultiplier > 0);
const isRangedEntry = entry => effectsOfEntry(entry).some(e => e.classification?.style && e.classification.style != 'melee');
const twoHanded = entry => effectsOfEntry(entry).some(e => String(e.numHands ?? '1') == '2');
const hasTrait = (entry, trait) => (entry.system?.traits ?? []).includes(trait);

/**
 * The picks each Perk makes. A plan is a list of slots; a Perk with alternatives asks first.
 * Service (Field Guide p.68): "training in 1 Limited Weapon of your choice."
 * Trade Goods (Ferocious Fighters p.14): "Qualified with a Limited or Restricted weapon of your choice."
 * For The Syndicate / Good To Go (Intercontinental Adventures p.101-102): "Qualified with 1 Limited
 *   weapon and 1 Limited battledress, or 1 Restricted weapon or battledress."
 * Ninpō JOEs (p.9): "Qualified with 1 Limited melee weapon and 1 Limited projectile weapon. One of
 *   these weapons must have the Martial Art trait."
 * Nu, Pogodi! (p.68): "1 Limited weapon that requires 2 Hands".
 */
async function planFor(perkUuid, item) {
  const limitedWeapon = { type: 'weapon', availabilities: ['limited'], label: 'Q1PickLimitedWeapon' };
  switch (perkUuid) {
  case Q1.service:
    return [limitedWeapon];
  case Q1.tradeGoods:
    return [{ type: 'weapon', availabilities: ['limited', 'restricted'], label: 'Q1PickLimitedRestrictedWeapon' }];
  case Q1.nuPogodi:
    return [{ ...limitedWeapon, matches: twoHanded, label: 'Q1PickTwoHandedWeapon' }];
  case Q1.ninpoJoes:
    return [
      { ...limitedWeapon, matches: isMeleeEntry, label: 'Q1PickMeleeWeapon' },
      { ...limitedWeapon, matches: isRangedEntry, label: 'Q1PickProjectileWeapon', needsMartialArtsUnless: 0 },
    ];
  case Q1.forTheSyndicate:
  case Q1.goodToGo: {
    const { chooseButtons } = await import("../../grants.mjs");
    const which = await chooseButtons(item.name, T('E20.Q1PickPlanPrompt'), [
      ['two', T('E20.Q1PlanLimitedPair')], ['weapon', T('E20.Q1PlanRestrictedWeapon')], ['armor', T('E20.Q1PlanRestrictedArmor')],
    ]);
    if (which == 'two') {
      return [limitedWeapon, { type: 'armor', availabilities: ['limited'], label: 'Q1PickLimitedArmor' }];
    }

    if (which == 'weapon' || which == 'armor') {
      return [{ type: which, availabilities: ['restricted'], label: which == 'weapon' ? 'Q1PickRestrictedWeapon' : 'Q1PickRestrictedArmor' }];
    }

    return null;
  }

  default:
    return null;
  }
}

/**
 * Pick the item(s) a chosen-item Perk qualifies you with, and store them on the Perk.
 * @param {Item} perk
 * @returns {Promise<?String>}   The chat line.
 */
export async function chooseQualifiedItems(perk) {
  const perkUuid = [...CHOSEN_QUALIFIED, ...CHOSEN_TRAINED].find(uuid => sourceOf(perk) == uuid);
  const plan = await planFor(perkUuid, perk);
  if (!plan) {
    return null;
  }

  const { findItems, pickOne } = await import("../../grants.mjs");
  const chosen = [];
  const entries = [];
  for (const [index, slot] of plan.entries()) {
    let matches = slot.matches ?? null;
    // Ninpō JOEs: if the first pick lacks the Martial Arts trait, the second has to carry it.
    if (slot.needsMartialArtsUnless != null && !hasTrait(entries[slot.needsMartialArtsUnless] ?? {}, 'martialArts')) {
      const base = matches;
      matches = entry => (!base || base(entry)) && hasTrait(entry, 'martialArts');
    }

    const rows = await findItems({ type: slot.type, availabilities: slot.availabilities, matches });
    const uuid = await pickOne(T(`E20.${slot.label}`), rows);
    if (!uuid) {
      return null;
    }

    const entry = await fromUuid(uuid);
    entries[index] = entry;
    chosen.push({ uuid, name: entry?.name ?? rows.find(row => row.uuid == uuid)?.name ?? '', type: slot.type });
  }

  await perk.setFlag('essence20', CHOSEN_FLAG, chosen);
  return T(CHOSEN_TRAINED.includes(perkUuid) ? 'E20.Q1TrainedChosen' : 'E20.Q1QualifiedChosen', {
    perk: perk.name, items: chosen.map(c => c.name).join(', '),
  });
}

/* -------------------------------------------- */
/*  Nothing Personal - the free Silencer          */
/* -------------------------------------------- */

/**
 * Nothing Personal (Intercontinental Adventures p.100): "gain a free Silencer upgrade for your
 * pistol." Fitted permanently to the pistol picked (once).
 */
export async function claimFreeSilencer(perk) {
  const actor = perk.parent;
  if (perk.flags?.essence20?.q1SilencerFitted) {
    ui.notifications.warn(T('E20.Q1SilencerAlready'));
    return null;
  }

  const weapons = actor.items.filter(item => item.type == 'weapon');
  const { chooseSelect } = await import("../../grants.mjs");
  const pistols = weapons.filter(weapon => /pistol|revolver|handgun/i.test(weapon.name));
  const weaponId = await chooseSelect(perk.name, T('E20.Q1SilencerPrompt'),
    (pistols.length ? pistols : weapons).map(weapon => ({ value: weapon.id, label: weapon.name })));
  const weapon = weaponId ? actor.items.get(weaponId) : null;
  if (!weapon) {
    return null;
  }

  const source = await fromUuid(SILENCER_UUID);
  if (!source) {
    return null;
  }

  const data = source.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', SILENCER_UUID);
  foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
  foundry.utils.setProperty(data, 'flags.essence20.q1FreeSilencer', true);
  const [created] = await actor.createEmbeddedDocuments('Item', [data]);
  const { setEntryAndAddItem } = await import("../../../sheet-handlers/attachment-handler.mjs");
  const key = await setEntryAndAddItem(created, weapon);
  if (key) {
    await created.setFlag('essence20', 'collectionId', key);
  }

  await perk.setFlag('essence20', 'q1SilencerFitted', true);
  return T('E20.Q1SilencerFitted', { weapon: weapon.name });
}

/* -------------------------------------------- */
/*  Nu, Pogodi! - swapping seats                  */
/* -------------------------------------------- */

function vehicleWith(actor) {
  for (const candidate of game.actors ?? []) {
    if (!['vehicle', 'zord'].includes(candidate.type)) {
      continue;
    }

    const entry = Object.entries(candidate.system?.actors ?? {}).find(([, crew]) => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle: candidate, key: entry[0], entry: entry[1] };
    }
  }

  return null;
}

/**
 * Nu, Pogodi!: "if you're riding in a vehicle, you can swap positions with someone else riding in
 * the same vehicle as a Free action with a DIF 10 Driving Skill Test. This Skill Test automatically
 * fails if the other driver is unwilling to swap positions with you."
 */
export async function swapSeats(perk, pay) {
  const actor = perk.parent;
  const seat = vehicleWith(actor);
  if (!seat) {
    ui.notifications.warn(T('E20.Q1SwapNoVehicle'));
    return null;
  }

  const others = Object.entries(seat.vehicle.system.actors ?? {})
    .filter(([key, crew]) => key != seat.key && crew?.uuid && ['driver', 'passenger'].includes(crew.vehicleRole));
  const { chooseSelect, rollTest } = await import("../../grants.mjs");
  const otherKey = await chooseSelect(perk.name, T('E20.Q1SwapPrompt'),
    others.map(([key, crew]) => ({ value: key, label: `${crew.name ?? key} (${crew.vehicleRole})` })));
  if (!otherKey || !(await pay('free'))) {
    return null;
  }

  const { success } = await rollTest(actor, 'driving', 10);
  if (!success) {
    return T('E20.Q1SwapFailed', { name: actor.name });
  }

  const other = seat.vehicle.system.actors[otherKey];
  const update = {
    [`system.actors.${seat.key}.vehicleRole`]: other.vehicleRole,
    [`system.actors.${otherKey}.vehicleRole`]: seat.entry.vehicleRole,
  };
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(seat.vehicle)) {
    await relayToGm(seat.vehicle, 'update', [update]);
  } else {
    await seat.vehicle.update(update);
  }

  return T('E20.Q1Swapped', { name: actor.name, other: other.name ?? '' });
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

const CHOICE_PERKS = [...CHOSEN_QUALIFIED, ...CHOSEN_TRAINED];

export const QUALIFY_USE = {
  id: 'q1Qualify',
  matches: item => item?.type == 'perk' && (CHOICE_PERKS.includes(sourceOf(item)) || sourceOf(item) == Q1.nothingPersonal),
  canUse: () => true,
  async run(item, economy, pay) {
    const source = sourceOf(item);
    if (source == Q1.nothingPersonal) {
      return claimFreeSilencer(item);
    }

    if (source == Q1.nuPogodi) {
      // Nu, Pogodi!'s own once-per-mission Condition removal (helpers/nu-pogodi.mjs) shares the Use
      // button, so it's offered here alongside the seat swap and the weapon pick.
      const { canUseNuPogodiCondition, applyNuPogodiCondition } = await import("../../nu-pogodi.mjs");
      const { chooseButtons } = await import("../../grants.mjs");
      const choices = [['weapon', T('E20.Q1ChooseWeapon')], ['swap', T('E20.Q1SwapSeats')]];
      if (canUseNuPogodiCondition(item.parent)) {
        choices.unshift(['condition', T('E20.Q1RemoveCondition')]);
      }

      const which = await chooseButtons(item.name, T('E20.Q1WhichUse'), choices);
      if (which == 'condition') {
        const removed = await applyNuPogodiCondition(item.parent);
        return removed ? T('E20.PerkUsedNotification', { perk: item.name, actor: item.parent.name }) : null;
      }

      if (which == 'swap') {
        return swapSeats(item, pay);
      }

      if (which != 'weapon') {
        return null;
      }
    }

    return chooseQualifiedItems(item);
  },
};

export function registerQualification() {
  registerUse(QUALIFY_USE);
  registerRollSources(qualificationSources);
  registerApplyDialog(qualificationApplyDialog);
  if (globalThis.Hooks?.on) {
    Hooks.on('essence20.requisitionAccess', onRequisitionAccess);
    Hooks.on('essence20.requisitionAvailability', onRequisitionAvailability);
    Hooks.on('essence20.kitPrerequisite', onKitPrerequisite);
  }
}
