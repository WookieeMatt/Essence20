import {
  activateCheerDefenseBoost, canAffordCheerDefenseBoost, getCheerDefenseBoost,
} from "./cheer-defense-boost.mjs";

/**
 * Tough Crowd (MLP CRB, Laugh Tactic, p.86): "You learned inner strength the first time you made
 * a joke and no one laughed. As a Move action, spend any amount of Cheer Points from your current
 * pool to gain an equal increase to both your Willpower and Cleverness Defenses for the rest of
 * the scene."
 *
 * See helpers/cheer-defense-boost.mjs's own doc comment for the shared amount-picker/spend/bank
 * shape this and Rotten Tomatoes both use.
 */
export const TOUGH_CROWD_ID = "Compendium.essence20.mlp_crb.Item.jKdu6PowM9GQkKW8";
const TOUGH_CROWD_FLAG = 'pendingToughCrowdBonus';

/** @param {Actor} actor @returns {Boolean} */
export function canUseToughCrowd(actor) {
  return canAffordCheerDefenseBoost(actor);
}

/** @param {Actor} actor @returns {Promise<Boolean>} */
export function activateToughCrowd(actor) {
  return activateCheerDefenseBoost(actor, TOUGH_CROWD_FLAG);
}

/**
 * The actor's own currently-banked Willpower/Cleverness bonus, still live this scene.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getToughCrowdBonus(actor) {
  return getCheerDefenseBoost(actor, TOUGH_CROWD_FLAG);
}
