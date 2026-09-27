/**
 * Morph-gated Active Effects - an effect whose own `system.whileMorphed` is set applies only while
 * the actor it lands on is Morphed.
 *
 * Several Power Rangers grants are printed "while Morphed" (every Ranger Prime's "Your Morphed
 * form immediately gains...", Frightening, Shadow Form's Infiltration Edge, ...). Defenses and
 * Movement already had a Morph-only field of their own (system.defenses.<d>.morphed,
 * system.movement.<m>.morphed), but an Edge, a Resistance or a skill shift had nothing, so those
 * effects applied unmorphed too. Foundry v14 asks an effect's own type data whether it is
 * suppressed (ActiveEffect#isSuppressed reads `this.system.isSuppressed`), which is the hook
 * used here: a suppressed effect is skipped by Actor#applyActiveEffects exactly like a disabled
 * one, but stays enabled, so it switches back on by itself the moment the actor Morphs again.
 */

/**
 * The actor an effect applies to - its own parent for an actor-owned effect, or the owning actor
 * of the Item it transfers from. Exported for helpers/environment-gated-effects.mjs's own
 * identical need (an effect's parent-to-actor resolution isn't specific to Morph gating).
 * @param {ActiveEffect} effect
 * @returns {Actor|null}
 */
export function getEffectActor(effect) {
  const parent = effect?.parent;
  if (!parent) {
    return null;
  }

  return parent.documentName == 'Actor' ? parent : (parent.actor ?? parent.parent ?? null);
}

/**
 * Whether a morph-gated effect is currently suppressed. Returns `undefined` (not false) when this
 * gate has nothing to say, so ActiveEffect#isSuppressed still falls back to its own duration-
 * expiry check.
 * @param {Object} effectData   The effect's own type data (effect.system), with its `parent`.
 * @returns {Boolean|undefined}
 */
export function isSuppressedWhileUnmorphed(effectData) {
  if (!effectData?.whileMorphed) {
    return undefined;
  }

  return getEffectActor(effectData.parent)?.system?.isMorphed ? undefined : true;
}
