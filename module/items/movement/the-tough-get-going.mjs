import { markOf } from "../../rules/predicate.mjs";

/**
 * The Tough Get Going (Factions in Action Vol. 2: Intercontinental Adventures, Oktober Guard General Perk, p.95).
 *
 * The Perk's own targeted Trigger rule (a missed roll against the holder's Toughness, once per round) marks the holder
 * `toughGetGoing` until the round ends (the scene, out of combat). While that mark lasts, Ground Movement is doubled -
 * documents/actor.mjs#_prepareMovement asks here, at the same point of the Movement loop as before, and the rules'
 * check:theToughGetGoing reads it too.
 */
export const TOUGH_GET_GOING_MARK = 'toughGetGoing';

/**
 * Whether the actor's doubled-Ground-Movement window is still running.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isTheToughGetGoingActive(actor) {
  return markOf(actor, TOUGH_GET_GOING_MARK);
}
