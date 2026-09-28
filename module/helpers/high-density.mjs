/**
 * High-Density (Factions in Action Vol. 2, New Weapon Traits, p.92; also granted by the High
 * Density weapon upgrade, p.93): "Upon a successful Attack, you can make a second Attack against a
 * different target within a 10ft line from the first target (↓1)."
 *
 * Reactive - it only exists once the first Attack has hit - so it is a post-roll chat button
 * (chat.mjs#addHighDensityButton), the same shape as Frenzied Attack. Clicking it rolls the same
 * weaponEffect again with `highDensityFollowUp` on its dataset, which dice.mjs#rollSkill turns into
 * a labelled ↓1 in the Roll Options Dialog. The follow-up is part of the same Attack, so it spends
 * no action of its own and skips the Reload gate (the round that went through the first target is
 * the same round). A follow-up can't chain into a third Attack.
 *
 * The player retargets before clicking; the button refuses while the original target is still the
 * only one selected. "Within a 10ft line from the first target" is left to the table - this system
 * has no line-from-a-token geometry check to enforce it.
 */

export const HIGH_DENSITY_FOLLOW_UP_SHIFT_DOWN = 1;

/**
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isHighDensityWeapon(weapon) {
  return !!weapon?.system?.traits?.includes('highDensity');
}

/**
 * Whether a posted attack card should offer the High-Density follow-up.
 * @param {Object} flags   The chat message's own flags.essence20 (dice.mjs's fullRollContext).
 * @returns {Boolean}
 */
export function canOfferHighDensityFollowUp(flags) {
  return !!flags?.isAttack && !!flags.isHighDensityAttack && !flags.highDensityFollowUp
    && flags.rollFailed === false && !!flags.itemUuid;
}

/**
 * Whether the user's current targets are a legal follow-up target set: at least one, and not just
 * the first Attack's own target again.
 * @param {Array<{actor?: {uuid: String}}>|Set} targets   The user's targeted tokens.
 * @param {String|null} originalTargetUuid
 * @returns {Boolean}
 */
export function hasDifferentTarget(targets, originalTargetUuid) {
  const list = Array.from(targets ?? []);
  return list.length > 0 && list.some(token => token?.actor?.uuid != originalTargetUuid);
}

/**
 * The dataset the follow-up Attack rolls with.
 * @returns {Object}
 */
export function highDensityFollowUpDataset() {
  return { highDensityFollowUp: true, bypassEconomy: true };
}

/**
 * Rolls the follow-up Attack with the same weaponEffect.
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect the first Attack used.
 * @returns {Promise<*>}
 */
export async function rollHighDensityFollowUp(actor, item) {
  return item.roll(highDensityFollowUpDataset(), actor);
}
