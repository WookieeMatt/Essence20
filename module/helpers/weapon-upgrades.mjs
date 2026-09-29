import { applyToVehicleEffect } from "./vehicle-upgrades.mjs";
/**
 * Weapon Upgrades that change the weapon they're attached to.
 *
 * An attached Upgrade has always been able to add or remove a trait (documents/item.mjs
 * #_prepareTraits). This file does everything else the upgrade tables print: double a range, grow a
 * blast, swap the attack skill, add a target, shrink the weapon, add a damage rider, and grant new
 * alternate effects. It works in three places:
 *
 * 1. applyToEffect() - called from a weaponEffect's prepareDerivedData. Adjusts the effect's own
 *    numbers in DERIVED data only; the paths it touched are recorded on the effect so the item
 *    sheet can keep editing the stored values (sheets/item-sheet.mjs) - an upgraded range must
 *    never be saved back as the base range.
 * 2. applyToWeapon() - called from the weapon's own prepareDerivedData: size steps, and the
 *    element a weapon deals once chosen.
 * 3. syncGeneratedEffects() - the alternate effects an upgrade GRANTS (Nonlethal's Stun, Tracer
 *    Rounds' Spot, the Laser trait's Stun and Spot...). Those are real weaponEffect Items, created
 *    when the upgrade arrives and deleted when it leaves, each tagged with the key that made it -
 *    the same "a granted effect is a real effect" shape linkedWeaponEffect (Explosive Rounds) uses.
 *
 * Upgrades are matched by compendium _id rather than full uuid: the same upgrade is printed in the
 * G.I. Joe, Transformers and Power Rangers core books under one _id.
 */

export const UPGRADE = {
  scope: 'cBiD2lBLRwnxu8Rx',
  smartScope: '3IbTYGc8LOp1IAHc',
  thermalScope: 'j9UxxlSMLRUcwGVk',
  eruptive: '0Q21VhUK1PNu1pTM',
  deadly: 'hd1O6anmtNcyjpw9',
  lingering: 'LyOKEFZd8vriKLOs',
  refinedGrip: 'nXYQmK90hnReB1H0',
  reinforcedGrip: 'fqdebwmS3b1Y0G48',
  automated: '1VeCvn1hnWoaNN9E',
  swift: '4yY2nOHsZuV0jT7M',
  microtech: 'ihSql0Px1kNgTBfP',
  bullpup: 'IU2HkMiwC8hYKQdj',
  tossableVial: 'swnhABvNaKuNY5FI',
  chemicalSprayer: 'PeOeKaDjkhtUWk10',
  rustDerivatives: 'h5tkU3gsCoMHGCFJ',
  timeBomb: 'VMZ8PDom0sJGyofl',
  proximityBomb: 'I2nS9xXN8ioV5jJ5',
  detonatorBomb: 'DMl6kKJe0iwW430D',
  chronoTrigger: 'eFsOmJPMyuUHhcQD',
  nonlethal: 'QbfY2NGNmUmKa6uO',
  covering: 'UfDHKErREKIeojVl',
  heavyHitting: '4yjmk8tENyBSPJrx',
  tracerRounds: 'uT2aZsKK307koPCu',
  surging: 'iDSVcsovl4V2uQmj',
  bewildering: '5T8ZrImJXHWqETnf',
  traumatic: 'zXPxC1yLlK2xgGEl',
  maiming: '6bg86Fau84u1m9Vg',
  surgical: 'rJqjZK5eL6TUZMmF',
  powerWeaponElement: '3J1qb2gaDMWxkBOF',
  elementalProjector: '9j0Qkz1o201pJ6uW',
  modularStandard: 'YiQEwRAKA8k5aswJ',
  modularLimited: 'nx3HyAPnwVWIKPVZ',
  modularRestricted: 'iddkqqgyaPpTmuiy',
  biomechanical: '7qniIaOGp8Mqwt6O',
  pillForm: 'lYMLqH3adOzo8Nmd',
  salveForm: 'JJ1KynH9FfYeOG7N',
  // PR CRB p.117 / TF CRB - both packs carry it under this id.
  manipulative: 'IJBeoPW2yUDWh2Wh',
};

// Perks (by full uuid) that change weapons the same way.
export const WEAPON_PERK = {
  fluidMotion: 'Compendium.essence20.intercontinental_adventures.Item.TESyOcJFtd9Qn9Tk',
  bigSwing: 'Compendium.essence20.ferocious_fighters.Item.sHJakOYf1rgVP6Pv',
  scrambleWave: 'Compendium.essence20.decepticon_directive.Item.2ehuQcJ1nwOvxSKl',
  hyperkineticHarness: 'Compendium.essence20.ferocious_fighters.Item.O4IT5jCPRBqGkXGr',
};

// The Elements a weapon can deal (GI Joe CRB p.207), keyed by damage type, with the trait each
// one is written as. Electromagnetic's damage type is 'emp'.
export const ELEMENTS = {
  acid: 'acid', cold: 'cold', electric: 'electric', emp: 'electromagnetic', fire: 'fire', laser: 'laser', sonic: 'sonic',
};
const ELEMENT_TRAITS = Object.values(ELEMENTS);

// Effects that don't deal damage - Deadly and Surging leave them alone.
export const NON_DAMAGE_TYPES = [
  'stun', 'cover', 'spot', 'maneuver', 'grapple', 'intimidate', 'knocProne', 'blindingBlast', 'frightened',
  'impaired', 'mesmerized', 'restrained', 'unconscious', 'modelock', 'special',
];

const SIZE_STEPS = ['integrated', 'sidearm', 'medium', 'long', 'heavy'];
const FIREBALL = 'Compendium.essence20.cobra_codex.Item.20lv1ecNs4ORVwWu';

// Power Weapon Element Damage Assignment (PR CRB p.116): "Black: Psychic, Blue: Cold, Green: Poison,
// Pink: x2 Energy, Red: Fire, and Yellow: Stun."
const RANGER_COLOR_DAMAGE = {
  black: 'psychic', blue: 'cold', green: 'poison', pink: 'energyDouble', red: 'fire', yellow: 'stun',
};

// Crit upgrades: "On a Critical Success, the weapon deals 1 damage to the target's <Essence>" (GI
// Joe CRB) - the Transformers and Power Rangers books name the Defense instead (Cleverness,
// Willpower, Evasion, Toughness), which is the same Essence.
export const CRIT_ESSENCE_UPGRADES = {
  [UPGRADE.bewildering]: 'social',
  [UPGRADE.traumatic]: 'smarts',
  [UPGRADE.maiming]: 'speed',
  [UPGRADE.surgical]: 'strength',
};

// The Transformers versions of the same four damage a Defense (TF CRB p.129-131): Bewildering "1
// damage to the target's Cleverness", Maiming Evasion, Surgical Toughness, Traumatic Willpower.
export const CRIT_DEFENSE_UPGRADES = {
  [UPGRADE.bewildering]: 'cleverness',
  [UPGRADE.traumatic]: 'willpower',
  [UPGRADE.maiming]: 'evasion',
  [UPGRADE.surgical]: 'toughness',
};

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

export function idOf(uuid) {
  return String(uuid ?? '').split('.').pop();
}

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
}

/**
 * The Upgrade Items attached to a weapon (on its actor, carrying the weapon's id as parentId).
 * @param {Item} weapon
 * @returns {Item[]}
 */
export function getAttachedUpgrades(weapon) {
  const actor = weapon?.parent;
  if (!actor?.items || !weapon?.id) {
    return [];
  }

  return actor.items.filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == weapon.id);
}

/**
 * How many copies of an upgrade (by compendium _id) a weapon carries.
 */
export function countUpgrade(weapon, upgradeId) {
  return getAttachedUpgrades(weapon).filter(item => idOf(sourceOf(item)) == upgradeId).length;
}

export function hasUpgrade(weapon, upgradeId) {
  return countUpgrade(weapon, upgradeId) > 0;
}

function findUpgrade(weapon, upgradeId) {
  return getAttachedUpgrades(weapon).find(item => idOf(sourceOf(item)) == upgradeId) ?? null;
}

function actorHas(actor, uuid) {
  return !!actor?.items?.find?.(item => sourceOf(item) == uuid);
}

/**
 * The weapon an effect belongs to.
 */
export function parentWeaponOf(effect) {
  const parentId = effect?.flags?.essence20?.parentId;
  return parentId ? effect.parent?.items?.get?.(parentId) ?? null : null;
}

/**
 * The element a weapon deals once chosen: its own choice ("When receiving an Element weapon for a
 * mission, you must first choose the type of element the weapon uses", GI Joe CRB p.207), an
 * Elemental Projector's choice, or none.
 * @returns {?String}   A damage type key of ELEMENTS.
 */
export function chosenElement(weapon) {
  const projector = findUpgrade(weapon, UPGRADE.elementalProjector);
  const projected = projector?.flags?.essence20?.elementChoice;
  return (projected && ELEMENTS[projected] ? projected : null)
    ?? (weapon?.system?.elementChoice && ELEMENTS[weapon.system.elementChoice] ? weapon.system.elementChoice : null);
}

/**
 * The Element traits a weapon has GAINED - from upgrades or from its chosen element - as opposed
 * to the ones printed on it. Printed Element weapons already list their own alternate effects; a
 * gained trait is what needs them generated.
 * @param {Item} weapon
 * @returns {String[]}   Trait keys.
 */
export function gainedElementTraits(weapon) {
  const own = weapon?._source?.system?.traits ?? [];
  const gained = new Set();
  for (const upgrade of getAttachedUpgrades(weapon)) {
    for (const trait of upgrade.system?.traits ?? []) {
      if (ELEMENT_TRAITS.includes(trait) && !own.includes(trait)) {
        gained.add(trait);
      }
    }
  }

  const element = chosenElement(weapon);
  if (element && !own.includes(ELEMENTS[element])) {
    gained.add(ELEMENTS[element]);
  }

  return [...gained];
}

/* -------------------------------------------- */
/*  1. The effect's own numbers                 */
/* -------------------------------------------- */

function rangerColor(actor) {
  const names = (actor?.items ?? []).filter(i => i.type == 'role').map(i => i.name.toLowerCase());
  return Object.keys(RANGER_COLOR_DAMAGE).find(color => names.some(name => name.includes(color))) ?? null;
}

/**
 * Adjust a weaponEffect's derived numbers for the upgrades on its weapon. Records every path it
 * touched in system.upgradeTouched, for the item sheet.
 * @param {Object} system   The effect's system data (derived - mutated in place).
 * @param {Item} effect     The effect Item.
 */
export function applyToEffect(system, effect) {
  const actor = effect?.parent;
  const weapon = parentWeaponOf(effect);
  const touched = new Set();
  const set = (path, value) => {
    foundry.utils.setProperty(system, path, value);
    touched.add(path);
  };

  // Scramble Wave (Decepticon Directive, Inquisitor, 20th level, p.40): "you add 1 Electromagnetic
  // damage ... to all your attacks." Rides on every attack that has no second damage already.
  if (actorHas(actor, WEAPON_PERK.scrambleWave) && !system.secondaryDamage?.type && !NON_DAMAGE_TYPES.includes(system.damageType)) {
    set('secondaryDamage.type', 'emp');
    set('secondaryDamage.value', 1);
  }

  // Robust Ram / Slashing Wings / the Biotech Performance Enhancer on a vehicle's own attacks.
  applyToVehicleEffect(system, actor, set);

  if (!weapon) {
    system.upgradeTouched = [...touched];
    return;
  }

  const count = id => countUpgrade(weapon, id);
  const damaging = !NON_DAMAGE_TYPES.includes(system.damageType);

  // The chosen element replaces a printed "Element" damage.
  const element = chosenElement(weapon);
  if (element && system.damageType == 'element') {
    set('damageType', element);
  }

  // Elemental Projector (Decepticon Directive p.75): "Changes damage type to a chosen Element type."
  const projector = findUpgrade(weapon, UPGRADE.elementalProjector)?.flags?.essence20?.elementChoice;
  if (projector && ELEMENTS[projector] && damaging) {
    set('damageType', projector);
  }

  // Power Weapon Element Damage Assignment (PR CRB p.116) - by the Ranger's color.
  if (count(UPGRADE.powerWeaponElement) && system.damageType == 'energy') {
    const assigned = RANGER_COLOR_DAMAGE[rangerColor(actor)];
    if (assigned == 'energyDouble') {
      set('damageValue', (system.damageValue ?? 0) * 2);
    } else if (assigned) {
      set('damageType', assigned);
    }
  }

  // Scope (p.148): "Double the ranges of the weapon." Smart Scope (p.153): "Increase effective range
  // by 1.5 and long range by 2."
  if (system.range?.value) {
    let value = system.range.value;
    let long = system.range.long;
    for (let i = 0; i < count(UPGRADE.scope); i++) {
      value *= 2;
      long = long ? long * 2 : long;
    }

    if (count(UPGRADE.smartScope)) {
      value = Math.ceil(value * 1.5);
      long = long ? long * 2 : long;
    }

    if (value != system.range.value) {
      set('range.value', value);
    }

    if (long != system.range.long) {
      set('range.long', long);
    }
  }

  // Tossable Vial (Cobra Codex p.97): "In addition to its range of Reach, this weapon gains a range
  // of 20ft/50ft and counts as a thrown weapon."
  if (count(UPGRADE.tossableVial) && !system.range?.value) {
    set('range.value', 20);
    set('range.long', 50);
  }

  // Chemical Sprayer (Cobra Codex p.97): "This poison can attack in a 15ft cone, rather than its
  // normal range of Reach."
  if (count(UPGRADE.chemicalSprayer)) {
    set('shape', 'cone');
    set('radius', 15);
  }

  // Time / Proximity / Detonator Bomb (p.116-118): "The grenade's range becomes Reach."
  if ([UPGRADE.timeBomb, UPGRADE.proximityBomb, UPGRADE.detonatorBomb].some(count)) {
    set('range.value', null);
    set('range.long', null);
    set('range.reachMultiplier', 1);
  }

  // Eruptive (p.149): "The blast radius of the explosive's effect doubles."
  if (count(UPGRADE.eruptive) && system.radius > 0) {
    set('radius', system.radius * (2 ** count(UPGRADE.eruptive)));
  }

  // A weapon changed for a while by a Perk (helpers/weapon-perk-uses.mjs): Explosive Ammo's blast,
  // Firestorm's tripled radius, Airburst's +10ft, Backblast's halved range, Utility Loaders' and
  // Tooled Munitions' damage type, or Stun instead of damage.
  const mutation = weapon.flags?.essence20?.mutation;
  if (mutation) {
    if (mutation.stunInstead && damaging) {
      set('damageType', 'stun');
    } else if (mutation.damageType && damaging) {
      set('damageType', mutation.damageType);
    }

    if (mutation.blastSet && !(system.radius > 0) && system.range?.value) {
      set('shape', 'circle');
      set('radius', mutation.blastSet);
    } else if (mutation.blastAdd && system.radius > 0) {
      set('radius', system.radius + mutation.blastAdd);
    }

    if (mutation.tripleNext && system.radius > 0) {
      set('radius', system.radius * 3);
    }

    if (mutation.airburstNext && system.radius > 0) {
      set('radius', system.radius + 10);
    }

    if (mutation.backblast && system.range?.value) {
      set('range.value', Math.ceil(system.range.value / 2));
      if (system.range.long) {
        set('range.long', Math.ceil(system.range.long / 2));
      }
    }
  }

  // Fireball (Cobra Codex p.59): Fire weapons' "main effect gains a 5-foot radius Blast area of
  // effect."
  if (actorHas(actor, FIREBALL) && (weapon.system?.traits ?? []).includes('fire') && damaging
    && !(system.radius > 0) && primaryEffect(weapon)?.id == effect.id) {
    set('shape', 'circle');
    set('radius', 5);
  }

  // Refined Grip / Reinforced Grip / Automated (p.150): "Use Finesse / Might / Technology instead of
  // the weapon's normal skill." Biomechanical Weapon (Ferocious Fighters p.94) - its chosen skill.
  const biomech = findUpgrade(weapon, UPGRADE.biomechanical);
  const skill = biomech?.flags?.essence20?.skillChoice
    ?? (count(UPGRADE.automated) ? 'technology'
      : count(UPGRADE.reinforcedGrip) ? 'might'
        : count(UPGRADE.refinedGrip) ? 'finesse' : null);
  if (skill && system.classification?.skill != skill) {
    set('classification.skill', skill);
  }

  // Biomechanical Weapon: "+↓1 on effects" of the weapon.
  if (biomech) {
    set('shiftDown', (system.shiftDown ?? 0) + 1);
  }

  // Swift (p.152): "Add Multiple Targets (2), or +1 to an existing Multiple Targets."
  if (count(UPGRADE.swift)) {
    set('numTargets', (system.numTargets ?? 1) > 1 ? system.numTargets + count(UPGRADE.swift) : 1 + count(UPGRADE.swift));
  }

  // Deadly (GI Joe CRB p.149): "The weapon's Sharp effects deal an additional Damage"; the
  // Transformers CRB (p.127) widens it to any Damage effect.
  const deadly = findUpgrade(weapon, UPGRADE.deadly);
  if (deadly && damaging
    && (system.damageType == 'sharp' || !String(sourceOf(deadly) ?? '').includes('gi_joe_crb'))) {
    set('damageValue', (system.damageValue ?? 0) + 1);
  }

  // Lingering (p.149): "Weapon effect measured in turns, like Stun 1 and Cover 1 - increase the
  // duration of the effect by 1 turn."
  if (count(UPGRADE.lingering) && ['stun', 'cover'].includes(system.damageType)) {
    set('damageValue', (system.damageValue ?? 0) + 1);
  }

  // Cold gained: "If the weapon already has a Stun effect, increase the Stun effect by 1" (p.207).
  if (system.damageType == 'stun' && gainedElementTraits(weapon).includes('cold') && !effect.flags?.essence20?.generatedKey) {
    set('damageValue', (system.damageValue ?? 0) + 1);
  }

  // Rust Derivatives (Decepticon Directive p.75): "Weapon deals 1 Acid damage in addition to its
  // normal Damage." The no-healing half is recorded on the target by dice.mjs.
  if (count(UPGRADE.rustDerivatives) && !system.secondaryDamage?.type) {
    set('secondaryDamage.type', 'acid');
    set('secondaryDamage.value', 1);
  }

  // Fluid Motion (Intercontinental Adventures p.13): "Silent Martial Arts weapons that already have a
  // Maneuver alternate effect lose any penalty for using this alternate effect."
  if (system.damageType == 'maneuver' && actorHas(actor, WEAPON_PERK.fluidMotion) && isSilentMartialArts(weapon)) {
    set('shiftDown', 0);
  }

  system.upgradeTouched = [...touched];
}

function isSilentMartialArts(weapon) {
  const traits = weapon?.system?.traits ?? [];
  return traits.includes('silent') && traits.includes('martialArts');
}

/* -------------------------------------------- */
/*  2. The weapon itself                        */
/* -------------------------------------------- */

/**
 * Size steps and hands. Called after the weapon's own effectiveSize/derivedHands are prepared.
 *
 * Microtech Weapon (p.149): "Reduce the weapon's size by one step ... can be applied to the same
 * weapon multiple times." Bullpup (Intercontinental Adventures p.92): "Reduce the size of the weapon
 * by one step." Hyperkinetic Support Harness (Ferocious Fighters p.69): "wield 2-handed weapons in
 * one hand." Motor Lancer (Intercontinental Adventures p.64): the same for a melee weapon, for the
 * turn it's switched on, while driving or riding.
 * @param {Item} weapon
 */
export function applyToWeapon(weapon) {
  const system = weapon.system;
  const steps = countUpgrade(weapon, UPGRADE.microtech) + countUpgrade(weapon, UPGRADE.bullpup);
  if (steps) {
    const from = SIZE_STEPS.indexOf(system.effectiveSize ?? system.classification?.size);
    if (from > 0) {
      system.effectiveSize = SIZE_STEPS[Math.max(0, from - steps)];
      if (system.hands == null) {
        system.derivedHands = CONFIG.E20.weaponSizeHands?.[system.effectiveSize] ?? system.derivedHands;
      }
    }
  }

  const actor = weapon.parent;
  if (system.derivedHands > 1 && (actorHas(actor, WEAPON_PERK.hyperkineticHarness) || isMotorLancing(actor))) {
    system.derivedHands = 1;
  }

  // Pill Form / Salve Form (Cobra Codex p.97): "Treat the poison as an ingested poison" / "...as a
  // contact poison."
  const form = hasUpgrade(weapon, UPGRADE.pillForm) ? 'ingested' : hasUpgrade(weapon, UPGRADE.salveForm) ? 'contact' : null;
  if (form && system.isPoison) {
    system.poisonApplication = { contact: form == 'contact', ingested: form == 'ingested', inhaled: false };
    system.upgradeTouched = [...new Set([...(system.upgradeTouched ?? []),
      'poisonApplication.contact', 'poisonApplication.ingested', 'poisonApplication.inhaled'])];
  }
}

const MOTOR_LANCER_FLAG = 'motorLancerTurn';

export function isMotorLancing(actor) {
  const stamp = actor?.getFlag?.('essence20', MOTOR_LANCER_FLAG);
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

export { MOTOR_LANCER_FLAG };

/* -------------------------------------------- */
/*  3. Granted alternate effects                */
/* -------------------------------------------- */

const MODULAR = [UPGRADE.modularStandard, UPGRADE.modularLimited, UPGRADE.modularRestricted];

/**
 * The weapon's own printed effect every generated alternate is modelled on: its first damaging
 * effect, else its first effect.
 */
export function primaryEffect(weapon) {
  const effects = (weapon?.parent?.items ?? []).filter(item => item.type == 'weaponEffect'
    && item.flags?.essence20?.parentId == weapon.id && !item.flags?.essence20?.generatedKey);
  return effects.find(effect => !NON_DAMAGE_TYPES.includes(effect._source?.system?.damageType ?? effect.system.damageType))
    ?? effects[0] ?? null;
}

/**
 * Every alternate effect this weapon should carry because of its upgrades, gained traits and its
 * wielder's Perks. Each is {key, name, changes} - changes are applied over a copy of the primary.
 * Modular weapons are resolved separately (they copy another weapon's own effects).
 * @param {Item} weapon
 * @returns {Array<Object>}
 */
export function desiredGeneratedEffects(weapon) {
  const primary = primaryEffect(weapon);
  if (!primary) {
    return [];
  }

  const actor = weapon.parent;
  const base = primary._source?.system ?? primary.system;
  const i18n = key => game.i18n.localize(key);
  const wanted = [];
  const add = (key, label, changes) => wanted.push({ key, name: `${label} (${weapon.name})`, changes });
  // The weapon's own printed effects only - a generated one may be about to go (a Laser Stun when the
  // element changes to Cold), and must not stop its replacement being made.
  const existingTypes = (actor?.items ?? []).filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon.id
    && !item.flags?.essence20?.generatedKey)
    .map(item => item._source?.system?.damageType ?? item.system.damageType);

  // Nonlethal (p.148): "The weapon's Blunt or Sharp damage effect can deal an equivalent amount of
  // Stun damage as an alternate effect."
  if (hasUpgrade(weapon, UPGRADE.nonlethal) && ['blunt', 'sharp'].includes(base.damageType)) {
    add('nonlethal', i18n('E20.DamageStun'), { damageType: 'stun', damageValue: base.damageValue });
  }

  // Covering (Intercontinental Adventures p.92): "The weapon gains Cover 1 as an Alternate Effect."
  if (hasUpgrade(weapon, UPGRADE.covering)) {
    add('covering', i18n('E20.DamageCover'), { damageType: 'cover', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Heavy Hitting (p.93): "This weapon gains Shove (↑1) as an Alternate Effect."
  if (hasUpgrade(weapon, UPGRADE.heavyHitting)) {
    add('heavyHitting', i18n('E20.WeaponAltShove'), { damageType: 'maneuver', damageValue: 1, accurateShiftUp: 1, shiftDown: 0, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Manipulative (PR CRB p.117): "Modified to reposition the target rather than harm them outright.
  // ... The weapon gains Maneuver as an alternate effect."
  if (hasUpgrade(weapon, UPGRADE.manipulative) && !existingTypes.includes('maneuver')) {
    add('manipulative', i18n('E20.DamageManeuver'), { damageType: 'maneuver', damageValue: 1, shiftDown: 0, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Tracer Rounds (p.94): "The weapon gains Spot as an Alternate Effect." Laser (p.207): "Laser
  // weapons gain Stun 1 as an alternate effect, and can be used to Spot targets as an alternate
  // effect." Only for a GAINED Laser trait - printed laser weapons already list both.
  const gained = gainedElementTraits(weapon);
  if (hasUpgrade(weapon, UPGRADE.tracerRounds) || gained.includes('laser')) {
    add('spot', i18n('E20.DamageSpot'), { damageType: 'spot', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  if (gained.includes('laser') && !existingTypes.includes('stun')) {
    add('laserStun', i18n('E20.DamageStun'), { damageType: 'stun', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Cold (p.207): "Cold weapons add Stun 1 as an alternate effect of the weapon. If the weapon
  // already has a Stun effect, increase the Stun effect by 1" - the second half is applyToEffect.
  if (gained.includes('cold') && !existingTypes.includes('stun')) {
    add('coldStun', i18n('E20.DamageStun'), { damageType: 'stun', damageValue: 1, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Sonic (p.207): "Sonic weapons gain an alternative effect identical to the weapon's primary
  // effect, but it targets Willpower with a ↓2."
  if (gained.includes('sonic')) {
    add('sonic', `${primary.name} - ${i18n('E20.DefenseWillpower')}`, { defenseType: 'willpower', shiftDown: (base.shiftDown ?? 0) + 2 });
  }

  // Fluid Motion (Intercontinental Adventures p.13): "Silent Martial Arts weapons gain Maneuver as an
  // alternate effect when you use them."
  if (actorHas(actor, WEAPON_PERK.fluidMotion) && isSilentMartialArts(weapon) && !existingTypes.includes('maneuver')) {
    add('fluidMotion', i18n('E20.DamageManeuver'), { damageType: 'maneuver', damageValue: 1, shiftDown: 0, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  // Versatile (Across the Stars p.79): "A weapon that has two methods of being wielded" - for a melee
  // weapon, Might or Finesse (PR CRB, "Versatile Melee (Might or Finesse, chosen at attack)"). The
  // other one is offered as an alternate; ranged Versatile weapons print their alternates already.
  const versatileSkill = { might: 'finesse', finesse: 'might' }[base.classification?.skill];
  if ((weapon.system?.traits ?? []).includes('versatile') && base.classification?.style == 'melee' && versatileSkill) {
    add('versatile', `${primary.name} - ${i18n(CONFIG.E20.skills?.[versatileSkill] ?? versatileSkill)}`, { 'classification.skill': versatileSkill });
  }

  // Big Swing (Ferocious Fighters p.37): "When wielding a heavy Anti-Tank or Ballistic weapon, [you]
  // also count as wielding a close combat heavy bludgeon" - its 1 Blunt and 1 Stun, and 2 Blunt.
  const traits = weapon.system?.traits ?? [];
  if (actorHas(actor, WEAPON_PERK.bigSwing) && (weapon.system?.classification?.size == 'heavy')
    && (traits.includes('antiTank') || traits.includes('ballistic'))) {
    const bludgeon = {
      'classification.skill': 'might', 'classification.style': 'melee', 'range.value': null, 'range.long': null,
      'range.reachMultiplier': 1, radius: 0, shape: null, numTargets: 1, shiftDown: 0, defenseType: 'toughness',
    };
    add('bigSwing', i18n('E20.WeaponAltHeavyBludgeon'), { ...bludgeon, damageType: 'blunt', damageValue: 1, 'secondaryDamage.type': 'stun', 'secondaryDamage.value': 1 });
    add('bigSwing2', i18n('E20.WeaponAltHeavyBludgeonTwoHands'), { ...bludgeon, damageType: 'blunt', damageValue: 2, 'secondaryDamage.type': null, 'secondaryDamage.value': 0 });
  }

  return wanted;
}

/**
 * The compendium weapon a Modular upgrade was set to (chosen when it was attached).
 */
function modularChoices(weapon) {
  return getAttachedUpgrades(weapon)
    .filter(upgrade => MODULAR.includes(idOf(sourceOf(upgrade))) && upgrade.flags?.essence20?.modularWeaponUuid)
    .map(upgrade => ({ upgrade, uuid: upgrade.flags.essence20.modularWeaponUuid }));
}

// One sync at a time per actor, so two triggers can't both create the same effect.
const running = new Map();

/**
 * Bring the actor's generated alternate effects in line with what its upgrades now grant: create
 * the missing ones, delete the ones whose reason is gone. Idempotent.
 * @param {Actor} actor
 * @returns {Promise<{created: Number, deleted: Number}>}
 */
export async function syncGeneratedEffects(actor) {
  if (!actor?.items) {
    return { created: 0, deleted: 0 };
  }

  const previous = running.get(actor.uuid) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => doSync(actor));
  running.set(actor.uuid, next);
  try {
    return await next;
  } finally {
    if (running.get(actor.uuid) === next) {
      running.delete(actor.uuid);
    }
  }
}

async function doSync(actor) {
  const weapons = actor.items.filter(item => item.type == 'weapon');
  const existing = actor.items.filter(item => item.type == 'weaponEffect' && item.flags?.essence20?.generatedKey);
  const keep = new Set();
  const toCreate = [];

  for (const weapon of weapons) {
    const primary = primaryEffect(weapon);
    for (const want of desiredGeneratedEffects(weapon)) {
      const key = `${weapon.id}:${want.key}`;
      keep.add(key);
      if (!existing.some(item => item.flags.essence20.generatedKey == key) && primary) {
        const data = primary.toObject();
        delete data._id;
        data.name = want.name;
        for (const [path, value] of Object.entries(want.changes)) {
          foundry.utils.setProperty(data.system, path, value);
        }

        foundry.utils.setProperty(data, 'flags.essence20.generatedKey', key);
        foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
        toCreate.push({ weapon, data });
      }
    }

    // Modular weapons: "the weapon counts as both the upgraded weapon and the chosen weapon" - the
    // chosen weapon's own effects become this one's alternates.
    for (const { upgrade, uuid } of modularChoices(weapon)) {
      const chosen = await fromUuid(uuid);
      const entries = Object.values(chosen?.system?.items ?? {}).filter(entry => entry?.type == 'weaponEffect');
      for (const [index, entry] of entries.entries()) {
        const key = `${weapon.id}:modular:${upgrade.id}:${index}`;
        keep.add(key);
        if (existing.some(item => item.flags.essence20.generatedKey == key)) {
          continue;
        }

        const source = await fromUuid(entry.uuid);
        if (!source) {
          continue;
        }

        const data = source.toObject();
        delete data._id;
        data.name = `${source.name} (${chosen.name})`;
        foundry.utils.setProperty(data, 'flags.essence20.generatedKey', key);
        foundry.utils.setProperty(data, 'flags.essence20.parentId', weapon.id);
        toCreate.push({ weapon, data });
      }
    }
  }

  const stale = existing.filter(item => !keep.has(item.flags.essence20.generatedKey));
  if (stale.length) {
    await removeFromWeapons(actor, stale);
    await actor.deleteEmbeddedDocuments('Item', stale.map(item => item.id));
  }

  if (toCreate.length) {
    const created = await actor.createEmbeddedDocuments('Item', toCreate.map(entry => entry.data));
    const { setEntryAndAddItem } = await import("../sheet-handlers/attachment-handler.mjs");
    for (const [index, effect] of created.entries()) {
      const key = await setEntryAndAddItem(effect, toCreate[index].weapon);
      if (key) {
        await effect.setFlag('essence20', 'collectionId', key);
      }
    }
  }

  return { created: toCreate.length, deleted: stale.length };
}

/**
 * Take deleted generated effects back out of their weapons' attachment lists.
 */
async function removeFromWeapons(actor, effects) {
  const byWeapon = new Map();
  for (const effect of effects) {
    const weapon = actor.items.get(effect.flags.essence20.parentId);
    const collectionId = effect.flags.essence20.collectionId;
    if (weapon && collectionId && weapon.system.items?.[collectionId]) {
      byWeapon.set(weapon, [...(byWeapon.get(weapon) ?? []), collectionId]);
    }
  }

  for (const [weapon, keys] of byWeapon) {
    await weapon.update(Object.fromEntries(keys.map(key => [`system.items.-=${key}`, null])));
  }
}

/**
 * Whether a change to this Item can change what effects are generated - an Upgrade on a weapon, a
 * weapon's element, or one of the Perks that grant alternates.
 */
export function affectsGeneratedEffects(item, changes = null) {
  if (item?.type == 'upgrade') {
    return !!item.flags?.essence20?.parentId || !!changes?.flags?.essence20;
  }

  if (item?.type == 'weapon') {
    return !changes || changes.system?.elementChoice !== undefined || changes.system?.traits !== undefined;
  }

  if (item?.type == 'perk') {
    return [WEAPON_PERK.fluidMotion, WEAPON_PERK.bigSwing, FIREBALL].includes(sourceOf(item));
  }

  return false;
}

/* -------------------------------------------- */
/*  Roll-time                                   */
/* -------------------------------------------- */

/**
 * The Essence damage a critical hit with this weapon can deal instead of repeating its effect -
 * Bewildering, Traumatic, Maiming, Surgical. "If this weapon has both ..., the attacker chooses."
 * @param {Item} weapon
 * @returns {Array<{essence: String, source: String}>}
 */
export function getCritEssenceOptions(weapon) {
  return getAttachedUpgrades(weapon)
    .map(upgrade => (String(sourceOf(upgrade) ?? '').includes('.tf_crb.')
      ? { defense: CRIT_DEFENSE_UPGRADES[idOf(sourceOf(upgrade))], source: upgrade.name }
      : { essence: CRIT_ESSENCE_UPGRADES[idOf(sourceOf(upgrade))], source: upgrade.name }))
    .filter(option => option.essence || option.defense);
}

/**
 * Surging (Cobra Codex p.97) is on this weapon and it deals Element damage.
 */
export function canSurge(weapon, effect) {
  return hasUpgrade(weapon, UPGRADE.surging) && Object.keys(ELEMENTS).includes(effect?.system?.damageType);
}

/**
 * Chrono-Trigger (A Jump Through Time p.69): "The weapon gains the Multiple Attacks (3, ↓2) special
 * trait."
 */
export function hasChronoTrigger(weapon) {
  return hasUpgrade(weapon, UPGRADE.chronoTrigger);
}

/* -------------------------------------------- */
/*  Choices made when an upgrade is attached    */
/* -------------------------------------------- */

const MODULAR_AVAILABILITY = {
  [UPGRADE.modularStandard]: 'standard',
  [UPGRADE.modularLimited]: 'limited',
  [UPGRADE.modularRestricted]: 'restricted',
};

async function pickFromList(title, prompt, options) {
  const choices = options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('');
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["window-app", "e20-window"],
    position: { width: 420 },
    content: `<p>${prompt}</p><div class="form-group"><select name="choice">${choices}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return result && result != 'cancel' ? result : null;
}

/**
 * The weapons a Modular upgrade can build in - every compendium weapon of its availability.
 * @param {String} availability
 * @returns {Promise<Array<{value: String, label: String}>>}
 */
export async function modularWeaponOptions(availability) {
  const options = new Map();
  for (const pack of game.packs.filter(p => p.documentName == 'Item' && p.metadata.system == 'essence20')) {
    const index = await pack.getIndex({ fields: ['type', 'system.availability'] });
    for (const entry of index) {
      if (entry.type == 'weapon' && entry.system?.availability == availability && !options.has(entry.name)) {
        options.set(entry.name, { value: entry.uuid, label: entry.name });
      }
    }
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Ask for whatever an upgrade needs decided when it goes on: Elemental Projector's Element,
 * Biomechanical Weapon's skill, the weapon a Modular upgrade builds in. Stored on the upgrade's own
 * flags; closing the question leaves it unset (the upgrade then does nothing until set).
 * @param {Item} upgrade   The attached upgrade Item.
 * @returns {Promise<Boolean>}   Whether anything was chosen.
 */
export async function promptUpgradeChoice(upgrade) {
  const id = idOf(sourceOf(upgrade));
  if (id == UPGRADE.elementalProjector) {
    const choice = await pickFromList(upgrade.name, game.i18n.localize('E20.UpgradeChooseElement'),
      Object.keys(ELEMENTS).map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.damageTypes[key]) })));
    if (choice) {
      await upgrade.setFlag('essence20', 'elementChoice', choice);
    }

    return !!choice;
  }

  if (id == UPGRADE.biomechanical) {
    // Biomechanical Weapon (Ferocious Fighters p.94): "Change skill to Animal Handling, Science or
    // Survival."
    const choice = await pickFromList(upgrade.name, game.i18n.localize('E20.UpgradeChooseSkill'),
      ['animalHandling', 'science', 'survival'].map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.skills[key]) })));
    if (choice) {
      await upgrade.setFlag('essence20', 'skillChoice', choice);
    }

    return !!choice;
  }

  const availability = MODULAR_AVAILABILITY[id];
  if (availability) {
    const options = await modularWeaponOptions(availability);
    const choice = options.length
      ? await pickFromList(upgrade.name, game.i18n.localize('E20.UpgradeChooseModularWeapon'), options)
      : null;
    if (choice) {
      await upgrade.setFlag('essence20', 'modularWeaponUuid', choice);
    }

    return !!choice;
  }

  return false;
}
