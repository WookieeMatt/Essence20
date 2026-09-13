import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47): "One of your
 * Alt Modes gains the following ability: Once per scene, you may use a Free action to activate a
 * friction-nullifying field and double your Movement until the end of your next turn."
 *
 * "Double your Movement" is read as EVERY Movement type the actor has (ground/aerial/aquatic/
 * climb/underground), unlike Rush the Line's own "ground Movement specifically" reading - RAW
 * here has no qualifier narrowing it to one type. A plain on/off flag read live in
 * documents/actor.mjs#_prepareMovement as a `*= 2` for each movement type, the exact same shape
 * Rush the Line's own identical doubling already establishes - including its real end-of-turn
 * auto-clear (essence20.mjs's own combatTurn/combatRound hook), approximated to "the end of the
 * activating actor's own current turn" rather than tracking a full extra turn boundary (the same
 * "close enough" duration simplification Rush the Line's own "until the end of your Move" already
 * accepts, here shortening RAW's own slightly longer "until the end of your NEXT turn" by one
 * turn rather than adding a second tracked boundary for it). Once per scene to ACTIVATE (the Free
 * action cost itself is unenforced, the standing action-economy gap).
 */
const FRICTIONLESS_MOVEMENT_FLAG = 'frictionlessMovementActive';
const FRICTIONLESS_MOVEMENT_ENCOUNTER_FLAG = 'frictionlessMovementUsedThisEncounter';

export function canUseFrictionlessMovement(actor) {
  return !hasUsedThisEncounter(actor, FRICTIONLESS_MOVEMENT_ENCOUNTER_FLAG);
}

export function isFrictionlessMovementActive(actor) {
  return !!actor.getFlag?.('essence20', FRICTIONLESS_MOVEMENT_FLAG);
}

/**
 * Activates Frictionless Movement's own Movement double and marks the scene used. Caller is
 * responsible for the canUseFrictionlessMovement gate (see banked-buffs.mjs).
 * @param {Actor} actor
 */
export async function activateFrictionlessMovement(actor) {
  await actor.setFlag('essence20', FRICTIONLESS_MOVEMENT_FLAG, true);
  await markUsedThisEncounter(actor, FRICTIONLESS_MOVEMENT_ENCOUNTER_FLAG);
}

/**
 * Clears the Movement double at the end of the activating actor's own turn - see this file's own
 * doc comment for the approximated duration.
 * @param {Actor} actor
 */
export async function deactivateFrictionlessMovementAtTurnEnd(actor) {
  if (isFrictionlessMovementActive(actor)) {
    await actor.setFlag('essence20', FRICTIONLESS_MOVEMENT_FLAG, false);
  }
}
