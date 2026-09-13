import { bankPendingBonus, clearPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level, p.288): "If you
 * do not make any attacks in a turn, spend a Free action to gain a cumulative upshift (to a
 * maximum of ↑3) and +1 Fire damage to your attacks on the following turn this scene; only once
 * per turn."
 *
 * "If you do not make any attacks in a turn" has no hook to verify - the same self-policed drop
 * this project already uses for dozens of other unenforceable narrative preconditions (Charge's
 * own "moved 10ft," etc.). Reuses `bankPendingBonus`/`getPendingBonus`/`clearPendingBonus`
 * (perks.mjs) - unlike every other user of that trio (which bank a single-use flag consumed by
 * exactly the next roll), this one re-banks a growing `stacks` count on each activation instead of
 * a fixed payload, since RAW's own "cumulative" clause means several activations across several
 * skipped turns should ADD UP before being spent. "On the following turn" is approximated as "the
 * actor's own next attack" (not strictly bounded to exactly one turn later) - the same
 * "approximate duration, don't hard-enforce the exact edges" idiom this project already applies to
 * every other imprecisely-timed effect. The +1 Fire damage half is folded into the ordinary
 * damageBonusValue accumulator rather than overriding the attack's own damage type - same
 * "+N damage" idiom Zordbane/Puissance/etc. already use, not a literal type-swap.
 */
const GROWING_SMOLDER_FLAG = 'growingSmolderBank';
const MAX_STACKS = 3;

export function getGrowingSmolderStacks(actor) {
  return getPendingBonus(actor, GROWING_SMOLDER_FLAG)?.stacks ?? 0;
}

/**
 * Increments the banked stack count (capped at 3, no cost - a Free action).
 * @param {Actor} actor
 * @returns {Promise<Number>}   The new stack count.
 */
export async function activateGrowingSmolder(actor) {
  const current = getGrowingSmolderStacks(actor);
  const next = Math.min(MAX_STACKS, current + 1);
  await bankPendingBonus(actor, GROWING_SMOLDER_FLAG, { stacks: next });
  return next;
}

/**
 * Reads and clears the banked stack count - called once the actor actually makes an attack,
 * whether or not it hits (RAW grants the bonus "to your attacks," not "to your hits").
 * @param {Actor} actor
 * @returns {Promise<Number>}   The stack count that was consumed (0 if there was nothing banked).
 */
export async function consumeGrowingSmolderStacks(actor) {
  const stacks = getGrowingSmolderStacks(actor);
  if (stacks > 0) {
    await clearPendingBonus(actor, GROWING_SMOLDER_FLAG);
  }

  return stacks;
}
