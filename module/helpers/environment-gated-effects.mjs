import { getEffectActor } from "./morph-gated-effects.mjs";
import { hasActiveEnvironmentalExpertise } from "./environmental-expertise.mjs";

/**
 * Environment-of-expertise-gated Active Effects - an effect whose own
 * `system.whileInEnvironmentOfExpertise` is set applies only while the actor it lands on has
 * toggled themselves as currently in their own environment of expertise (see
 * helpers/environmental-expertise.mjs's own doc comment on why that's a manual toggle).
 *
 * Same isSuppressed hook helpers/morph-gated-effects.mjs already established for "while Morphed"
 * effects (Foundry v14's ActiveEffect#isSuppressed reads `this.system.isSuppressed`) - generalized
 * here rather than duplicated, since Taking Point (GI Joe CRB, Predator Focus, 6th level, p.93:
 * "you gain +1 to Alertness, Initiative, and Survival, or +2 if you are in your environment of
 * expertise") shipped with its own extra +1-in-environment Active Effect already authored and
 * disabled, with nothing to ever enable it - the same "static AE can't be conditioned on a
 * runtime toggle" gap Environmental Armor's own doc comment (dice.mjs) already names, just solved
 * here via suppression instead of a live dice.mjs check, since this bonus is a plain skill
 * shiftUp with no attack-roll pipeline to hook into.
 */

/**
 * Whether an environment-gated effect is currently suppressed. Returns `undefined` (not false)
 * when this gate has nothing to say, so ActiveEffect#isSuppressed still falls back to its own
 * duration-expiry check (or another gate, e.g. whileMorphed, if that's also set).
 * @param {Object} effectData   The effect's own type data (effect.system), with its `parent`.
 * @returns {Boolean|undefined}
 */
export function isSuppressedOutOfEnvironment(effectData) {
  if (!effectData?.whileInEnvironmentOfExpertise) {
    return undefined;
  }

  const actor = getEffectActor(effectData.parent);
  return actor && hasActiveEnvironmentalExpertise(actor) ? undefined : true;
}
