import {
  activateCheerDefenseBoost, canAffordCheerDefenseBoost, getCheerDefenseBoost,
} from "./cheer-defense-boost.mjs";

/**
 * Rotten Tomatoes (MLP CRB, Laugh Tactic, p.86): "You're used to avoiding incoming projectiles.
 * As a Move action, spend any amount of Cheer Points from your current pool to gain an equal
 * increase to both your Toughness and Evasion Defenses for the rest of the scene."
 *
 * See helpers/cheer-defense-boost.mjs's own doc comment for the shared amount-picker/spend/bank
 * shape this and Tough Crowd both use.
 */
export const ROTTEN_TOMATOES_ID = "Compendium.essence20.mlp_crb.Item.0DcWZaKg0GVFV3ei";
const ROTTEN_TOMATOES_FLAG = 'pendingRottenTomatoesBonus';

/** @param {Actor} actor @returns {Boolean} */
export function canUseRottenTomatoes(actor) {
  return canAffordCheerDefenseBoost(actor);
}

/** @param {Actor} actor @returns {Promise<Boolean>} */
export function activateRottenTomatoes(actor) {
  return activateCheerDefenseBoost(actor, ROTTEN_TOMATOES_FLAG);
}

/**
 * The actor's own currently-banked Toughness/Evasion bonus, still live this scene.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getRottenTomatoesBonus(actor) {
  return getCheerDefenseBoost(actor, ROTTEN_TOMATOES_FLAG);
}
