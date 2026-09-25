import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Rightful Place (Story of the Seasons, General Perk, p.131): "If the player character group
 * agrees to put you in charge (once/game session) and carries out your instructions as you
 * intended them to be followed, you may heal 1 Health or Essence loss suffered from Stress."
 *
 * Only the Health half is built. The Stress-Essence-loss alternative has no hook anywhere in this
 * codebase to heal - Stress is a purely narrative MLP concept here (referenced only in flavor text
 * like Chatter Flashback's own Hang-Up, "you suffer 1 Stress"), never modeled as a tracked
 * resource on the actor data model at all, so there is no Essence-loss-from-Stress value to
 * restore. "The group agrees and follows your lead" is an unenforceable narrative precondition,
 * left GM-adjudicated like every other such qualifier this project already accepts (e.g. Bits To
 * Spare/Truthseeker).
 */
export const RIGHTFUL_PLACE_ID = "Compendium.essence20.story_of_the_seasons.Item.XxIMOIXK6QOKlD8b";
const RIGHTFUL_PLACE_ENCOUNTER_FLAG = 'rightfulPlaceUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseRightfulPlace(actor) {
  return !hasUsedThisEncounter(actor, RIGHTFUL_PLACE_ENCOUNTER_FLAG);
}

/**
 * Heals 1 Health, capped at the actor's max, and marks the scene used.
 * @param {Actor} actor
 */
export async function activateRightfulPlace(actor) {
  await actor.update({
    'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + 1),
  });
  await markUsedThisEncounter(actor, RIGHTFUL_PLACE_ENCOUNTER_FLAG);
}
