import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * Through the Arches (Across the Stars, Phantom Ranger, 18th level, p.63): "By spending 2
 * Personal Power, you and your ship can pass 'through the Arches'... reappearing within 30 feet
 * of any object, person, or place... Characters who travel with you and do not have this Role
 * Perk arrive befuddled by the transfer and suffer Snag on all Skill Tests for 1 minute after
 * arrival."
 *
 * The teleport itself (choosing a destination, moving the tokens) is a manual GM/player action,
 * not something to mechanize - same "drop the geometry, keep the target-based mechanic" idiom this
 * project already applies elsewhere. The one concrete mechanical clause is the arrival Snag:
 * applied to every currently-targeted companion (the "auto-detect via targets" idiom Mark
 * Target/Splinter Defense already use, generalized here to every targeted token at once rather
 * than a single pick) who doesn't hold this Perk themselves. "For 1 minute" is approximated as
 * "their next Skill Test," this project's usual duration idiom - consumed in
 * dice.mjs#_getAutomaticCombatModifiers alongside Debilitating Strike's own flag-consumption
 * (same shape: `snag = true`, reported for rollSkill() to clear).
 *
 * Each companion RAW-technically also needs to spend 2 Personal Power of their own to come along -
 * not enforced (a GM-adjudicated detail, same as every other "the rest of the group must also..."
 * clause left to the table); only the granter's own 2-Power cost is charged here.
 */
const THROUGH_THE_ARCHES_ID = "Compendium.essence20.across_the_stars.Item.f372LpDqqiO2XoEi";
export const THROUGH_THE_ARCHES_SNAG_FLAG = 'pendingThroughTheArchesSnag';

/**
 * Applies the arrival Snag to every currently-targeted companion who doesn't hold Through the
 * Arches themselves - called once the granter's own 2-Power cost has already been paid.
 * @param {Actor} actor   The Ranger using the Perk (excluded even if self-targeted).
 * @returns {Promise<Number>}   How many companions were actually marked.
 */
export async function applyThroughTheArchesSnag(actor) {
  const companions = Array.from(game.user.targets ?? [])
    .map(token => token.actor)
    .filter(companion => companion && companion != actor && !actorHasPerk(companion, THROUGH_THE_ARCHES_ID));

  for (const companion of companions) {
    // eslint-disable-next-line no-await-in-loop
    await bankPendingBonus(companion, THROUGH_THE_ARCHES_SNAG_FLAG, { snag: true });
  }

  return companions.length;
}
