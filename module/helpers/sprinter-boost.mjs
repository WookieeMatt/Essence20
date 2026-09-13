import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44): "Once per
 * scene, you may double your Movement for one round." The +20ft Alt-Mode Ground Movement half
 * lives directly in documents/actor.mjs#_prepareMovement's own SPRINTER_ID check instead.
 *
 * "Your Movement" is read as Ground only (this Perk's own Alt-Mode-Ground focus), unlike
 * Frictionless Movement's identical-sounding "every type" reading - same distinction that Perk's
 * own doc comment already draws against Rush the Line. Otherwise an exact structural copy of
 * Frictionless Movement's own toggle + real end-of-turn auto-clear shape (essence20.mjs's own
 * combatTurn/combatRound hook), including the same "the end of the activating turn, one turn
 * short of RAW's own next-turn boundary" duration approximation. Once per scene to ACTIVATE (the
 * Free action cost itself is unenforced, the standing action-economy gap).
 */
const SPRINTER_BOOST_FLAG = 'sprinterBoostActive';
const SPRINTER_BOOST_ENCOUNTER_FLAG = 'sprinterBoostUsedThisEncounter';

export function canUseSprinterBoost(actor) {
  return !hasUsedThisEncounter(actor, SPRINTER_BOOST_ENCOUNTER_FLAG);
}

export function isSprinterBoostActive(actor) {
  return !!actor.getFlag?.('essence20', SPRINTER_BOOST_FLAG);
}

/**
 * Activates Sprinter's own Ground Movement double and marks the scene used. Caller is responsible
 * for the canUseSprinterBoost gate (see banked-buffs.mjs).
 * @param {Actor} actor
 */
export async function activateSprinterBoost(actor) {
  await actor.setFlag('essence20', SPRINTER_BOOST_FLAG, true);
  await markUsedThisEncounter(actor, SPRINTER_BOOST_ENCOUNTER_FLAG);
}

/**
 * Clears the Movement double at the end of the activating actor's own turn - see this file's own
 * doc comment for the approximated duration.
 * @param {Actor} actor
 */
export async function deactivateSprinterBoostAtTurnEnd(actor) {
  if (isSprinterBoostActive(actor)) {
    await actor.setFlag('essence20', SPRINTER_BOOST_FLAG, false);
  }
}
