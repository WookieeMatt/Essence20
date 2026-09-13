import { bankPendingBonus } from "./perks.mjs";

/**
 * Rev Your Engines! (A Jump Through Time, Grid Power, p.58): "When you are a driver, or co-pilot,
 * of any kind of vehicle including your Zord and Megazord, you can spend Personal Power gain
 * upshift 1 on a Driving Skill Test. You may not spend more than 3 Personal Power this way per
 * turn."
 *
 * A variable-cost Power (already capped at maxPowerCost: 3 in the compendium item, matching RAW's
 * own per-use cap) - the actual spend is handled generically by sheet-handlers/power-handler.mjs
 * before onPowerUse runs, so this only needs to bank the matching shiftUp for the actor's own next
 * Driving roll - the same bank-now/consume-on-next-matching-roll shape Grid Power Strike's own
 * damage bank already established, just applied to a shift instead of damage. "Per turn" isn't
 * separately enforced beyond the per-click maxPowerCost cap - this project's existing turn-scoped
 * gates are all binary used/not-used, not a cumulative-spend tracker, and RAW's own 1-Power-per-1-
 * shiftUp ratio already caps a single activation at the same +3 ceiling.
 */
export const PENDING_REV_YOUR_ENGINES_FLAG_KEY = 'pendingRevYourEnginesShiftUp';

/**
 * @param {Actor} actor
 * @param {Number} amountSpent   How much Power was spent on this activation.
 */
export async function activateRevYourEngines(actor, amountSpent) {
  if (!amountSpent) {
    return;
  }

  await bankPendingBonus(actor, PENDING_REV_YOUR_ENGINES_FLAG_KEY, { shiftUp: amountSpent });
}
