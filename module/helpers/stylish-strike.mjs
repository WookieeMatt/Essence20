import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Stylish Strike (A Jump Through Time, Grid Power, p.58): "Anytime you inflict a Critical Success
 * with any kind of melee Attack, you remove the Frightened, Impaired, or Mesmerized conditions
 * from all allies in the scene."
 *
 * "Critical Success" is this project's own established reading of a Degrees-of-Success multiplier
 * of 2 or more (see Shoots and Scores' identical `result.multiplier >= 2` check), not the separate
 * natural-max-die `isCrit` mechanic. "All allies in the scene" (not just nearby) reuses
 * getNearbyAllyTokens with an Infinity radius, the same "any ally on the scene" idiom Plan of
 * Action/Inspiration's own scope already establishes - includes the actor's own allies only, not
 * the actor itself (getNearbyAllyTokens already excludes the caller).
 */
const STYLISH_STRIKE_CONDITIONS = ['frightened', 'impaired', 'mesmerized'];

/**
 * @param {Actor} actor   The actor who just landed the Critical Success.
 */
export async function applyStylishStrike(actor) {
  const allies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  for (const ally of allies) {
    const toRemove = STYLISH_STRIKE_CONDITIONS.filter(condition => ally.statuses?.has(condition));
    for (const condition of toRemove) {
      await ally.toggleStatusEffect(condition, { active: false });
    }
  }
}
