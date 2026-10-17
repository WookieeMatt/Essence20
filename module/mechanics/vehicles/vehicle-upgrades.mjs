/**
 * Vehicle Upgrades (Quartermaster's Guide to Gear, p.55-61, and A Jump Through Time p.73) and the
 * vehicle traits that had no rule.
 *
 * A vehicle Upgrade is embedded straight on the Vehicle actor (sheet-handlers/drop-handler.mjs).
 * Until now that is all it did. This file gives each one its effect, in four places:
 *
 * - applyToVehicle(): the upgrades' Movement rules at their own stages (vehicleBase, vehicle).
 * - crewSources(): the ↑/↓/Edge a crew member (or the vehicle itself) gets on a roll - an Instrument
 *   Array...
 * - defenderSources(): what an attacker suffers against the vehicle - Shielded...
 * (The once-per damage cuts - Active Protection System, Slat and Reactive Armor - are DamageReduction rules on the
 * upgrades, rules/plugins/tags/damage-source.mjs.)
 *
 * Self-Destruct is a Use rule on the upgrade (step scheduleNextRound - rules/plugins/combat/next-round-schedule.mjs).
 * (Kill Counter, Nameplate and Tinted Canopy are item rules - DieSubstitution scope crew, a Use + crew RollModifier,
 * RollModifier scope crewIncoming: rules/plugins/combat/crew-incoming.mjs.)
 *
 * Many upgrades are item rules instead (system.rules - granted traits, Armor Plating, Racing Stripes,
 * Stealthy, Ablative Armor, JAFF, Tricked-Out Hydraulics, Camo Netting's switch, Afterburners, ECM,
 * Smokescreen, Spiked, the jammers...), run by module/rules/.
 */

import { markUsed } from "../resources/scene-clock.mjs";
import { restClears } from "../../rules/limits.mjs";
import { applyMovementStage } from "../../rules/plugins/effects/derived-hook-movement.mjs";

// Afterburners, Double-Barrel, Electronic Countermeasures, Energized Plating, Energy Resistant, both jammers, Evasive
// Handling, Flight Conversion, Nitrogen-Enhanced Rocket Fuel, Smokescreen, Spiked and Targeting System are item rules
// on the upgrades (rules/conv14-systems.test.js); so are the Anti-Matter Reactor, Camo Netting, Optimized Seating, Shallow
// Draft, Submarine Mode, Treads, the Biotech Performance Enhancer and Aerial Interface (rules/conv17-split3.test.js).

/**
 * The vehicle an actor is crewing, and in what seat.
 * @param {Actor} actor
 * @returns {?{vehicle: Actor, role: String}}
 */
export function getCrewedVehicle(actor) {
  if (!actor?.uuid || !game?.actors) {
    return null;
  }

  const actors = game.actors.contents ?? (typeof game.actors[Symbol.iterator] == 'function' ? [...game.actors] : []);
  for (const vehicle of actors) {
    if (vehicle.type != 'vehicle') {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

function isStampCurrent(stamp) {
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

/* -------------------------------------------- */
/*  The vehicle's own numbers                   */
/* -------------------------------------------- */

/**
 * The vehicle upgrades' Movement rules, at the point of the vehicle's preparation where they belong: Movement rules at
 * stage vehicleBase (Shallow Draft, Submarine Mode), then at stage vehicle (the Anti-Matter Reactor's x3, the Biotech
 * Performance Enhancer, Optimized Seating, Camo Netting) - rules/plugins/effects/vehicle-movement-stages.mjs. Called from
 * documents/actor.mjs#_prepareVehicleData after the driver-count halving. (Aerial Interface's shield is a Defense rule on
 * the driver's Perk, scope driven; the Biotech Performance Enhancer's hardpoint damage an ItemModifier stage item rule.)
 * @param {Actor} vehicle
 */
export function applyToVehicle(vehicle) {
  if (vehicle?.type != 'vehicle') {
    return;
  }

  applyMovementStage(vehicle, 'vehicleBase');
  applyMovementStage(vehicle, 'vehicle');
}

/**
 * Whether a vehicle weapon is fired with the vehicle's own Targeting rather than its crew member's:
 * the driver fires it as a Standard action with the vehicle's Targeting (GI Joe CRB p.172,
 * Targeting System).
 */
export function usesVehicleTargeting(vehicle, weapon) {
  return vehicle?.type == 'vehicle' && (!!vehicle.system?.traits?.targetingSystem
    || (weapon?.system?.traits ?? []).includes('targetingSystem'));
}

/* -------------------------------------------- */
/*  Rolls                                       */
/* -------------------------------------------- */

/**
 * The ↑/↓/Edge sources a roll gets from the vehicle its roller is crewing (or is). Each source:
 * {id, label, shiftUp, shiftDown, edge, snag}.
 * @param {Actor} actor       Who is rolling.
 * @param {String} skill      The skill rolled.
 * @param {?Item} _item       The weaponEffect or other item rolled, if any.
 * @returns {Array<Object>}
 */
export function crewSources(actor, skill, _item) {
  const sources = [];
  const crewed = actor?.type == 'vehicle' ? { vehicle: actor, role: 'self' } : getCrewedVehicle(actor);
  if (!crewed) {
    return sources;
  }

  const { vehicle } = crewed;
  // (Treads' and Hydraulic Bounce's Edge on Driving in Rough Terrain are RollModifier rules on them -
  // check:vehicleInRoughTerrain.)

  // Instrument Array (Across the Stars p.87): Edge on the vehicle's Alertness while a crew member
  // spends a Free action each turn on the scanners.
  if (skill == 'alertness' && vehicle.system?.traits?.instrumentArray) {
    sources.push({ id: 'instrumentArray', label: game.i18n.localize('E20.VehicleTraitInstrumentArray'), shiftUp: 0, shiftDown: 0, edge: true, snag: false });
  }

  return sources;
}

/**
 * What an attacker suffers against a vehicle - or against someone inside one. Each source is the
 * same shape as crewSources'; `once` names a once-per-combat use to spend when the roll is made.
 * @param {Actor} attacker
 * @param {Item} item        The weaponEffect.
 * @param {Actor} target
 * @param {Object} context   {weaponTraits: String[]}
 */
export function defenderSources(attacker, item, target, _context = {}) {
  const sources = [];
  if (item?.type != 'weaponEffect') {
    return sources;
  }

  // (A Tinted Canopy's Snag on Laser attacks at an occupant is a RollModifier scope crewIncoming rule on it.)
  if (!['vehicle', 'zord'].includes(target?.type)) {
    return sources;
  }

  // (Spiked's ↓1 and Energized Plating's ↓2 - or the damage when the attacker turns them down - are incoming
  // DialogSelect rules on those upgrades.)

  // Shielded (Across the Stars p.87): each turn, the first N attacks or damaging effects on the
  // vessel take a Snag. The number is the vehicle's shieldedRating (Shield
  // Matrix's DerivedStat rule sets it on a Zord).
  const rating = Number(target.system?.shieldedRating) || (target.system?.traits?.shielded ? 1 : 0);
  if (rating && shieldedHitsThisTurn(target) < rating) {
    sources.push({ id: 'shielded', label: game.i18n.localize('E20.VehicleTraitShielded'), snag: true, countShielded: true });
  }

  return sources;
}

function shieldedHitsThisTurn(vehicle) {
  const record = vehicle?.getFlag?.('essence20', 'shieldedHits');
  return record && isStampCurrent(record) ? record.count : 0;
}

/**
 * Spend the once-per-combat sources a roll used, and count a Shielded hit.
 */
export async function spendDefenderSources(target, sources) {
  for (const source of sources) {
    if (source.once) {
      await markUsed(target, source.once);
    }

    if (source.countShielded) {
      const combat = game.combat;
      await target.setFlag('essence20', 'shieldedHits', {
        combatId: combat?.id, round: combat?.round, turn: combat?.turn, count: shieldedHitsThisTurn(target) + 1,
      });
    }
  }
}

/**
 * Pressurized Cabin (and Submarine Mode): "The sealed compartment grants immunity to Poison and
 * Disease" - to everyone aboard. Their item rules seal the cabin (system.pressurized).
 */
export function isSealedAboard(actor) {
  const crewed = getCrewedVehicle(actor);
  return !!crewed && !!crewed.vehicle.system?.pressurized;
}

/* -------------------------------------------- */
/*  Use buttons                                 */
/* -------------------------------------------- */

// (Afterburners, Electronic Countermeasures, Smokescreen, Evasive Handling, Flight Conversion, both jammers and
// Self-Destruct are Use rules on the upgrades.)

/**
 * A crew member's Rest is the new day for the vehicle they crew too: its once-per-rest rule uses (Nameplate's Use) are
 * available again.
 */
export async function resetDailyVehicleUses(vehicle) {
  const clears = restClears(vehicle);
  if (clears.length) {
    await vehicle.update(Object.fromEntries(clears.map(key => [key, new foundry.data.operators.ForcedDeletion()])));
  }
}

// (The Element Energy Resistant and Energized Plating ask for, and the weapon Double-Barrel and Targeting System
// ask for, are pick steps in their 'added' Trigger rules - legacy flags elementChoice / weaponId.)
