/**
 * Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32): while
 * Morphed, up to 4 Personal Power, each +1 armor Toughness until unmorphing.
 *
 * Unlike every other "spend a resource, gain a bonus" Perk in this project, the SPEND amount is
 * itself a player choice (1-4, capped by what they can actually afford) rather than a fixed or
 * scaling number - a new pickPoweredPlatingAmount() dialog (a numeric input, the same DialogV2
 * shape as mechanics/resources/banked-buffs.mjs#pickHobbleCondition's own select, just a number field
 * instead). The granted bonus can't touch _prepareDefenses (the user's own pending Defense-math
 * migration) - like Phantom Suite's own Evasion Defense bonus, it's a live, non-consumed read in
 * dice.mjs's per-target checkEntries construction instead, applying to every Toughness-compared
 * attack for as long as it lasts, not just the next one. "Until you are no longer Morphed" is
 * actively cleared (not left to the player to notice) via sheet-handlers/power-ranger-handler.mjs
 * #onMorph, right where Boosted Vigor's own Morph-time toggle already lives.
 */

// Written by the Perk's own Use rule (a spend of 1-4 Personal Power, then an updateActor of @spent on this flag).
const POWERED_PLATING_FLAG = 'poweredPlatingBonus';

/**
 * The actor's own currently-banked Toughness Defense bonus, if still Morphed - 0 otherwise (also
 * the safety-net path if onMorph's own clear somehow didn't fire).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getPoweredPlatingBonus(actor) {
  return actor?.system?.isMorphed ? (actor.getFlag?.('essence20', POWERED_PLATING_FLAG) ?? 0) : 0;
}

/**
 * Clears the banked bonus - called from onMorph() right as the actor un-Morphs, no refund.
 * @param {Actor} actor
 */
export async function clearPoweredPlating(actor) {
  await actor.unsetFlag('essence20', POWERED_PLATING_FLAG);
}
