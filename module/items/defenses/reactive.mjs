/**
 * Reactive (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "The nanomites
 * within your body enable you to react more quickly when you are threatened. You gain +1 to your
 * Evasion. This nanomite power is considered always on and does not count against your daily uses
 * of nanomite powers. You may expend a use of your nanomite power to add an additional +1 to your
 * Evasion (+2 total) for 1 scene."
 *
 * This entry was previously miscategorized against the "reaction/interrupt hook" gap - RAW-
 * verified 2026-09-15 and corrected: "react more quickly" here is flavor text for a flat Evasion
 * bonus, not an actual in-flight reaction mechanic. Textually identical in shape to this same
 * book's own already-built Protection (p.94, the Toughness-flavored sibling) - a permanent base
 * bonus plus an optional scene-scoped boost toggle, same two-part "always on" nanomite power
 * pattern this project already established there. Mirrors protection.mjs exactly, just Evasion
 * instead of Toughness.
 */
const REACTIVE_BOOST_FLAG = 'reactiveBoostActive';
const REACTIVE_BOOST_BONUS = 1;

export function isReactiveBoostActive(actor) {
  return !!actor.getFlag?.('essence20', REACTIVE_BOOST_FLAG);
}

/**
 * Flips the Reactive scene-boost on/off for this actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state (true = now active).
 */
export async function toggleReactiveBoost(actor) {
  const nowActive = !isReactiveBoostActive(actor);
  await actor.setFlag('essence20', REACTIVE_BOOST_FLAG, nowActive);
  return nowActive;
}

/**
 * The scene-boost's own live, non-consumed Evasion bonus while active (0 otherwise) - read in
 * dice.mjs's per-target checkEntries construction, the same shape getProtectionBoostBonus already
 * established.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getReactiveBoostBonus(actor) {
  return isReactiveBoostActive(actor) ? REACTIVE_BOOST_BONUS : 0;
}
