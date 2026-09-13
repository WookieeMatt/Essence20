import { bankPendingBonus } from "./perks.mjs";

/**
 * Brute Force Works Best (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 17th level,
 * p.24): "when you successfully hit a piece of equipment with a blade or bludgeon, any Skill
 * Tests using the equipment or that the equipment makes suffer Snag and ↓1 until the start of
 * your next turn."
 *
 * "Until the start of your next turn" is approximated as "the target's next Skill Test," the
 * same single-consumption idiom this project already uses for every other "until X" duration
 * (Debilitating Strike's identical Snag-on-next-roll shape, just with a shiftDown folded in too).
 */
const PENDING_FLAG = 'pendingBruteForceWorksBest';

/**
 * Banks the Snag + downshift on the just-hit piece of equipment.
 * @param {Actor} targetActor
 */
export async function markBruteForceWorksBest(targetActor) {
  await bankPendingBonus(targetActor, PENDING_FLAG, { snag: true, shiftDown: 1 });
}

export { PENDING_FLAG as BRUTE_FORCE_WORKS_BEST_FLAG };
