import { registerDerived, registerRollSources } from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { D21, T, findSourced, itemsOf, sourceOf } from "./common.mjs";

/**
 * Gear with a data-only gap:
 * - Drone Defenses upgrades (G.I. Joe CRB, Drone Upgrades, p.168-169): Basic "The drone gains a bonus
 *   to +1 Toughness or Evasion as though it was wearing battledress", Advanced +2, Specialized +3.
 *   Stored as armorBonus {defense, value} on the upgrade, but the actor's armor pass only reads armor
 *   upgrades - so a drone's Defense upgrades are added here. "As though it was wearing battledress":
 *   armor doesn't stack, so the best one per Defense counts.
 * - Sky Morpher (A Jump Through Time, R.P.M. Morphers, p.68): "The Sky Morpher links to a Ranger's
 *   Zord Attack Vehicles, granting an additional ↑1 bonus to Driving their own Zord."
 */

const DRONE_DEFENSES = [D21.basicDefenses, D21.advancedDefenses, D21.specializedDefenses];

export function droneDefenseBonus(actor) {
  const best = {};
  if (actor?.type != 'companion' || actor.system?.type != 'drone') {
    return best;
  }

  for (const upgrade of itemsOf(actor)) {
    if (upgrade.type != 'upgrade' || upgrade.system?.type != 'drone' || !DRONE_DEFENSES.includes(sourceOf(upgrade))) {
      continue;
    }

    const defense = upgrade.system?.armorBonus?.defense;
    const value = parseInt(upgrade.system?.armorBonus?.value) || 0;
    if (defense && value > (best[defense] ?? 0)) {
      best[defense] = value;
    }
  }

  return best;
}

export function applyDroneDefenses(actor) {
  for (const [defenseType, value] of Object.entries(droneDefenseBonus(actor))) {
    const defense = actor.system?.defenses?.[defenseType];
    if (!defense || !value) {
      continue;
    }

    defense.total = (Number(defense.total) || 0) + value;
    if (typeof defense.string == 'string') {
      defense.string += ` + ${value} (${T('D21DroneDefenses')})`;
    }
  }
}

registerDerived(applyDroneDefenses);

/* -------------------------------------------- */
/*  Sky Morpher                                  */
/* -------------------------------------------- */

function crewEntry(vehicle, actor) {
  return Object.values(vehicle?.system?.actors ?? {}).find(entry => entry?.uuid == actor?.uuid) ?? null;
}

function driverOf(zord) {
  const entry = Object.values(zord?.system?.actors ?? {}).find(e => e?.vehicleRole == 'driver');
  return entry?.uuid ? worldActors().find(a => a.uuid == entry.uuid) ?? null : null;
}

/** "Their own Zord": listed on the Ranger's sheet, or linked to them as its owner. */
export function ownsZord(actor, zord) {
  if (!actor || !zord) {
    return false;
  }

  const listed = Object.values(actor.system?.actors ?? {}).some(entry => entry?.uuid == zord.uuid);
  return listed || zord.flags?.essence20?.companionOf == actor.uuid;
}

/** The Zord this Ranger is driving right now, if it's theirs. */
export function drivenOwnZord(actor) {
  return worldActors().find(zord => zord.type == 'zord' && crewEntry(zord, actor)?.vehicleRole == 'driver' && ownsZord(actor, zord)) ?? null;
}

export function skyMorpherSources(actor, target, { rolledSkill } = {}) {
  if (rolledSkill != 'driving' || !actor) {
    return { sources: [] };
  }

  // The Ranger rolling Driving from their own sheet, or the Zord rolling with its driver's.
  const pilot = actor.type == 'zord' ? driverOf(actor) : actor;
  const zord = actor.type == 'zord' ? (ownsZord(pilot, actor) ? actor : null) : drivenOwnZord(actor);
  const morpher = findSourced(pilot, D21.skyMorpher);
  if (!zord || !morpher) {
    return { sources: [] };
  }

  return { sources: [{ id: 'd21SkyMorpher', label: morpher.name, shiftUp: 1 }] };
}

registerRollSources(skyMorpherSources);
