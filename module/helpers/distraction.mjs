import { isMonsterFormActive } from "./monster-morph.mjs";

/**
 * Distraction (Finster's Monster-Matic Cookbook, Path of Venom, 5th level, p.299): "As a Free
 * action, use mean-spirited words and gestures to throw off enemy attacks; ranged Attacks
 * targeting you suffer a downshift until the beginning of your next turn. Usable only when
 * Morphed and not in Monster Form."
 *
 * A plain on/off toggle (no cost - RAW names none, just a Free action), the same shape Power
 * Boost/Dig In already establish, but read from the TARGET's own side (the reciprocal shiftDown
 * check lives in dice.mjs's own `_getAutomaticCombatModifiers`, alongside Fight Me!'s identical
 * "check the OTHER actor's flag" shape) rather than the roller's. "Until the beginning of your
 * next turn" has no active expiry - the same unenforced-duration idiom used throughout this
 * project - a player switches it back off manually once it should have worn off.
 */
const DISTRACTION_FLAG = 'distractionActive';

export function isDistractionActive(actor) {
  return !!actor?.getFlag?.('essence20', DISTRACTION_FLAG);
}

/**
 * Flips the actor's own Distraction stance. Turning it ON requires being Morphed and not in
 * Monster Form (returns null if not); turning it back OFF is always allowed.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}
 */
export async function toggleDistraction(actor) {
  const nowActive = !isDistractionActive(actor);
  if (nowActive && (!actor.system.isMorphed || isMonsterFormActive(actor))) {
    return null;
  }

  await actor.setFlag('essence20', DISTRACTION_FLAG, nowActive);
  return nowActive;
}
