/**
 * Fly In The Future (GI Joe CRB, Pilot Origin Benefit, p.62): "Embarking or disembarking a vehicle
 * only takes 5 feet of your movement, not half your movement. Additionally, you have been trained
 * in evasive maneuvers. You may halve the speed of your Aerial vehicle, which forces all attacks
 * against it to target its Evasion Defense instead of Toughness. This lasts until the beginning of
 * its next turn."
 *
 * RE-CATEGORIZED 2026-09-15 out of a 12-item narrative bucket. The evasive-maneuvers half is real,
 * self-contained mechanics; the embark/disembark clause is NOT built (movement-cost accounting for
 * boarding a vehicle isn't modelled anywhere - the same action-economy gap as everywhere else).
 *
 * The flag lives on the VEHICLE, not the pilot: RAW's effect is a property of how that airframe is
 * flying, it applies to attacks made by anyone against it, and the halved speed is the vehicle's.
 * The pilot is only who decides to do it. That also means the piloted vehicle has to be resolved
 * from the pilot here rather than through dice.mjs's own private _getPilotedVehicle, which this
 * file can't reach - the same inline crew scan lend-assistance.mjs#isAboardVehicle already uses.
 *
 * "Until the beginning of its next turn" is not actively expired - this project has no per-actor
 * turn-boundary hook to clear a flag on, so it's a manual toggle-off, the same accepted duration
 * idiom as Dig In and every other on/off toggle here. Unlike those, though, this one carries a real
 * cost while it's on (halved Aerial Movement, read in documents/actor.mjs#_prepareMovement), so
 * leaving it on is self-penalising rather than free.
 */
export const EVASIVE_MANEUVERS_FLAG = 'evasiveManeuversActive';
export const FLY_IN_THE_FUTURE_ID = "Compendium.essence20.gi_joe_crb.Item.rFeczlniKUs8Rk3q";

/**
 * The Aerial vehicle this actor is currently crewing, if any - see this file's own doc comment for
 * why the lookup is inline rather than through dice.mjs.
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function getPilotedAerialVehicle(actor) {
  if (!actor?.uuid) {
    return null;
  }

  return game.actors?.find(
    candidate => candidate.type == 'vehicle'
      && candidate.system?.movement?.aerial?.base > 0
      && Object.values(candidate.system?.actors ?? {}).some(crew => crew.uuid == actor.uuid),
  ) ?? null;
}

/**
 * Whether the given vehicle is currently flying evasively.
 * @param {Actor} vehicle
 * @returns {Boolean}
 */
export function isEvasiveManeuversActive(vehicle) {
  return !!vehicle?.getFlag?.('essence20', EVASIVE_MANEUVERS_FLAG);
}

/**
 * Toggles evasive maneuvers on the pilot's own Aerial vehicle.
 * @param {Actor} actor   The pilot.
 * @returns {Promise<Boolean|null>}   The new state, or null with no Aerial vehicle to fly.
 */
export async function toggleEvasiveManeuvers(actor) {
  const vehicle = getPilotedAerialVehicle(actor);
  if (!vehicle) {
    return null;
  }

  const nowActive = !isEvasiveManeuversActive(vehicle);
  await vehicle.setFlag('essence20', EVASIVE_MANEUVERS_FLAG, nowActive);

  return nowActive;
}
