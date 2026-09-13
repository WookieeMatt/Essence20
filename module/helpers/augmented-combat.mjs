/**
 * Augmented Combat (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.92): "When you
 * activate this power, the nanomites flood your body with a rush of adrenaline-like synth meds,
 * heightening your reaction times, strength, and agility. You gain ↑1 on all attacks for one
 * minute."
 *
 * A plain on/off toggle - no cost exists to charge against (`powerCost` is null and RAW's own
 * "twice a day" nanomite-use cap isn't tracked anywhere in this codebase, same gap already
 * documented on helpers/protection.mjs), so this is free to switch either direction, the same
 * shape as Dig In. "For one minute" is approximated as "until switched back off," this project's
 * usual duration idiom for an effect this system has no timer for.
 */
const AUGMENTED_COMBAT_FLAG = 'augmentedCombatActive';

export function isAugmentedCombatActive(actor) {
  return !!actor.getFlag?.('essence20', AUGMENTED_COMBAT_FLAG);
}

/**
 * Flips Augmented Combat on/off for this actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state (true = now active).
 */
export async function toggleAugmentedCombat(actor) {
  const nowActive = !isAugmentedCombatActive(actor);
  await actor.setFlag('essence20', AUGMENTED_COMBAT_FLAG, nowActive);
  return nowActive;
}
