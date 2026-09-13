/**
 * Undo Engine (Factions in Action Vol. 2: Intercontinental Adventures, Engineer Troop Focus, 20th
 * level, p.71): "You can sabotage enemy equipment by applying your understanding of engineering
 * in reverse. At 20th level, if your Attack against a vehicle is a Critical Success, the target
 * vehicle's driver must succeed on a DIF 20 Driving Skill Test, or the vehicle's Movement is
 * reduced to 0 until the driver uses their Standard action to restart the engines."
 *
 * Triggered directly from the ATTACKER's own successful roll (dice.mjs's post-hit processing,
 * the same "checkContext flag set unconditionally, read on result" shape as Spot/Stick In The
 * Spokes) once a Critical Success against a vehicle target is confirmed - fires the target
 * vehicle's own driver's flat-DIF Driving Skill Test via actor._dice.rollSkill(), the same
 * "trigger a real dialog roll from inside another roll's own resolution" shape Jury Rig/Duty Of
 * The Graphite/Absolute Menace already established, just triggered from a DIFFERENT actor's roll
 * (the attacker's) rather than a "Use" button on the driver's own sheet.
 *
 * "The vehicle's Movement is reduced to 0" is a plain, unenforced marker flag on the vehicle - the
 * same "visible marker, not hard enforcement" idiom Stick In The Spokes' own "inoperable" flag
 * already established (this codebase has no vehicle-repair mechanism, and here specifically there
 * is also no "restart the engines" action anywhere to hook an automatic clear onto) - a GM/player
 * manages the edges manually, same as Stick In The Spokes.
 */

const FLAG_KEY = 'undoEngineMovementDisabled';

/**
 * Fires the given vehicle's own driver's flat-DIF-20 Driving Skill Test, threading the vehicle's
 * own uuid through so a failed result can be applied back to it.
 * @param {Actor} driver
 * @param {Actor} vehicle
 */
export async function triggerUndoEngineCheck(driver, vehicle) {
  await driver._dice.rollSkill({
    skill: 'driving', essence: 'speed', shiftUp: 0, shiftDown: 0, dif: '20',
    isUndoEngineCheckAttempt: true, undoEngineVehicleUuid: vehicle.uuid,
  }, driver);
}

/**
 * Marks the vehicle's Movement as disabled - called from dice.mjs's own post-roll FAILURE
 * handling for the driver's own Driving Test above.
 * @param {Actor} vehicle
 */
export async function markUndoEngineMovementDisabled(vehicle) {
  await vehicle.setFlag('essence20', FLAG_KEY, true);
}

/**
 * Whether the given vehicle's Movement is currently marked disabled by Undo Engine.
 * @param {Actor} vehicle
 * @returns {Boolean}
 */
export function isUndoEngineMovementDisabled(vehicle) {
  return !!vehicle?.getFlag?.('essence20', FLAG_KEY);
}
