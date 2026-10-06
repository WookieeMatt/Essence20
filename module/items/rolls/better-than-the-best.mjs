import { actorHasPerk } from "../../mechanics/characters/perks.mjs";

/**
 * Better than the Best - a rule that has to sit inside the roll itself, called from dice.mjs. Kept synchronous
 * and light - this file imports nothing heavier than perks.mjs, so dice.mjs can import it at the top.
 */

const HAWK = "Compendium.essence20.general_hawk_s_personel_files.Item.";

export const BETTER_THAN_THE_BEST_ID = `${HAWK}1Xy3GpglIFAq3sqc`;

/**
 * Better than the Best (Hawk's Personnel Files, Old Hand, 10th level, p.165): "when you roll a 20
 * on the d20 during a Skill Test, you succeed at the Skill Test. If you would already succeed at
 * the Skill Test normally, it is considered a Critical Success." Read off the kept d20 (the one
 * an Edge/Snag keeps - Foundry's `values` are the active results only).
 * @param {Actor} actor   The roller.
 * @param {Roll} roll
 * @param {Number} multiplier   This entry's Degrees of Success so far (0 miss, 1 success, 2+ crit).
 * @returns {Number}   The new multiplier.
 */
export function betterThanTheBestMultiplier(actor, roll, multiplier) {
  if (!actorHasPerk(actor, BETTER_THAN_THE_BEST_ID)) {
    return multiplier;
  }

  const d20 = (roll?.dice ?? []).find(pool => pool.faces === 20);
  const values = d20?.values ?? (d20?.results ?? []).filter(r => r.active !== false).map(r => r.result);
  if (!values?.includes?.(20)) {
    return multiplier;
  }

  return multiplier > 0 ? Math.max(multiplier, 2) : 1;
}
