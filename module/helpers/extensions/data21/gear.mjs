import { registerRollSources } from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { D21, findSourced } from "./common.mjs";

/**
 * Gear with a data-only gap:
 * - Sky Morpher (A Jump Through Time, R.P.M. Morphers, p.68): "The Sky Morpher links to a Ranger's
 *   Zord Attack Vehicles, granting an additional ↑1 bonus to Driving their own Zord."
 * (The G.I. Joe drone Defenses upgrades are item rules now.)
 */

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
