import { getNearbyAllyTokens } from "./allies.mjs";
import { pickAllyTargets } from "./banked-buffs.mjs";

/**
 * Power Heal (Power Rangers Core Rulebook, Grid Power, p.100): "By focusing the energy of the
 * Morphin Grid into a living being, you can knit wounded flesh. While Morphed, you can spend Power
 * while touching an injured living creature. Each Power spent heals 1 damage or removes one
 * negative condition (poison, transformed into a plant, etc.)."
 *
 * Only the healing half is built - "removes one negative condition" doesn't scale with Power spent
 * the way healing does (1 point removes exactly one condition, however much is spent), so it would
 * need its own separate dynamic-option picker (like Eltarian Mettle's own "pick from whichever
 * Conditions the target actually has" dialog) layered on top of this same spend - flagged as a gap
 * rather than force-picked, same idiom Healing Light's own unautomated "or remove all current
 * poisons" half already established.
 *
 * "Touching" is approximated as "adjacent" (5 feet) - the closest numeric reading of RAW's own
 * word, tighter than every other ally-targeting range this project has already had to judgment-call
 * (Helping Hand's 60ft, Bumper Crop's 30ft "Short range"). Self is a valid target too (nothing in
 * RAW rules it out), via the same includeSelf idiom team-buffs.mjs already established.
 */
const POWER_HEAL_TOUCH_RANGE_FEET = 5;

/**
 * Prompts for a target (self or an adjacent ally) and heals them by the amount of Power spent.
 * @param {Actor} actor        The pilot activating the Power.
 * @param {Number} amountSpent How much Power was spent on this activation.
 * @param {String} itemName    The Power item's own display name, for the picker dialog's title.
 * @returns {Promise<{targetActor: Actor, healAmount: Number}|null>}   The healed actor and amount,
 *   or null if there was nothing to spend or the picker was cancelled.
 */
export async function activatePowerHeal(actor, amountSpent, itemName) {
  if (!amountSpent) {
    return null;
  }

  const candidateAllies = [actor, ...getNearbyAllyTokens(actor, POWER_HEAL_TOUCH_RANGE_FEET).map(token => token.actor).filter(Boolean)];
  const [targetActor] = await pickAllyTargets(actor, candidateAllies, itemName);
  if (!targetActor) {
    return null;
  }

  await targetActor.update({
    'system.health.value': Math.min(targetActor.system.health.max, targetActor.system.health.value + amountSpent),
  });

  return { targetActor, healAmount: amountSpent };
}
