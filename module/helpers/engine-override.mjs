/**
 * Engine Override (Factions in Action Vol. 2: Intercontinental Adventures, Engineer Troop Focus,
 * 3rd level, p.72): "You're able to squeeze more performance out of vehicles. At 3rd level, as a
 * Move action, you can increase the Movement of a vehicle within reach by 15ft, or as a Free
 * action, if you are riding or driving the vehicle. This bonus lasts until the beginning of your
 * next turn."
 *
 * Action-cost distinction (Move vs. Free) is unenforced, same as every other action-economy
 * nuance this codebase doesn't track - the "Use" button just resolves whichever vehicle applies:
 * the actor's own piloted vehicle (covers the Free-action "riding or driving it" case, via
 * actor._dice's own _getPilotedVehicle(actor) - no role argument, matching either seat, the same
 * generic crew-lookup Roadside Assistant already uses) if they're seated in one, else the
 * currently-targeted token's vehicle actor (covers the Move-action "within reach" case) - "within
 * reach" itself isn't range-checked, the same accepted simplification Menacing Glare/Duty Of The
 * Graphite/Absolute Menace already use for their own unenforced range/reach qualifiers.
 *
 * "The Movement" is read as Ground Movement specifically - the only type every vehicle is
 * guaranteed to have, matching how Boost of Speed/Eltarian Training's own unqualified "Movement"
 * clauses already default to the base stat rather than a named type.
 *
 * Duration is approximated to "for the rest of the round it was granted in," not a literal
 * turn-boundary clear - unlike Rush the Line/Regenerating Shell (banked on the GRANTER and cleared
 * on the granter's own turn boundary via the existing combatTurn hook in essence20.mjs), this
 * bonus lives on a DIFFERENT actor (the vehicle), and nothing tracks which vehicle to go clear
 * when a specific actor's turn starts. Re-checked live every time Movement is prepared instead,
 * the same round-granularity idiom Warrior Rush's own "until the beginning of your next turn"
 * clause already uses (documents/actor.mjs#_prepareMovement).
 */

const FLAG_KEY = "pendingEngineOverrideBoost";

/**
 * Resolves which vehicle Engine Override should apply to: the actor's own piloted vehicle if
 * they're seated in one, else the currently-targeted token's vehicle actor.
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function getEngineOverrideTarget(actor) {
  const pilotedVehicle = actor._dice?._getPilotedVehicle(actor);
  if (pilotedVehicle) {
    return pilotedVehicle;
  }

  const targetActor = game.user.targets.first()?.actor;
  return targetActor?.type === 'vehicle' ? targetActor : null;
}

/**
 * Grants the resolved target vehicle its +15ft Ground Movement boost for the rest of this round.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>} The vehicle boosted, or null if there was nothing valid to
 *   target (surfaced as a warning by the caller).
 */
export async function activateEngineOverride(actor) {
  const vehicle = getEngineOverrideTarget(actor);
  if (!vehicle) {
    return null;
  }

  await vehicle.setFlag('essence20', FLAG_KEY, { round: game.combat?.round ?? null });
  return vehicle;
}

/**
 * Whether a vehicle actor currently has an active, unexpired Engine Override boost.
 * @param {Actor} vehicle
 * @returns {Boolean}
 */
export function isEngineOverrideBoostActive(vehicle) {
  const flag = vehicle.getFlag?.('essence20', FLAG_KEY);
  return !!flag && flag.round === (game.combat?.round ?? null);
}
