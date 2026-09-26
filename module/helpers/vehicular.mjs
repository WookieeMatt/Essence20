import { getMode, isBlocking } from "./action-economy.mjs";

/**
 * Vehicular (GI Joe CRB, Weapon Effects and Traits, p.148; identical wording recurs in every core
 * rulebook's own Weapon Traits list): "This weapon is too unwieldy for a soldier and can only be
 * mounted on a vehicle."
 *
 * An equip/attack ELIGIBILITY restriction (which actor TYPE may use this weapon at all), not a
 * combat modifier - so it hangs off the same world-setting strictness this system already uses
 * for the action economy (helpers/action-economy.mjs's own track/warn/strict modes), rather than
 * inventing a second enforcement dial: 'off'/'track' let it through untouched (the same silent
 * default every unauthored action cost gets), 'warn' posts a heads-up but still lets the roll
 * through, and 'strict' blocks it outright for anyone but a GM - isBlocking() already encodes
 * that exact "GMs always bypass" rule.
 */

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isVehicleActor(actor) {
  return actor?.type == 'vehicle';
}

/**
 * @param {Actor} actor   The would-be wielder.
 * @param {String} weaponName
 * @returns {Boolean}   Whether the attack/equip may proceed.
 */
export function checkVehicularEligibility(actor, weaponName) {
  if (isVehicleActor(actor)) {
    return true;
  }

  if (isBlocking()) {
    ui.notifications.warn(game.i18n.format('E20.VehicularRequiresVehicle', { name: weaponName }));
    return false;
  }

  if (getMode() == 'warn') {
    ui.notifications.warn(game.i18n.format('E20.VehicularRequiresVehicle', { name: weaponName }));
  }

  return true;
}
