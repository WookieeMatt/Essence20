import { bankPendingBonus } from "./perks.mjs";

/**
 * Mistrustful (Cobra Codex, Influence Hang-Up, p.32): "When you fail an Alertness Skill Test to
 * judge another's intentions, you suffer Snag on your next Skill Test." This codebase has no way
 * to distinguish "an Alertness Test to judge another's intentions" from any other Alertness Test
 * (no narrative-purpose tagging anywhere on a roll), so - the same approximation this project
 * already accepts for similarly narrow-context triggers - this fires on ANY failed Alertness
 * Skill Test. Banked the same unscoped Snag, consumed-on-next-roll shape as Flying Nuisance/
 * Misled (bankPendingBonus/getPendingBonus).
 */
export const MISTRUSTFUL_HANGUP_ID = "Compendium.essence20.cobra_codex.Item.sQ00MnGryA2GNzHF";
export const MISTRUSTFUL_SNAG_FLAG = 'pendingMistrustfulSnag';

/**
 * Banks the unscoped Snag on the actor - see this file's own doc comment. Consumed in
 * dice.mjs's own unscoped-bonus block.
 * @param {Actor} actor
 */
export async function markMistrustfulSnag(actor) {
  await bankPendingBonus(actor, MISTRUSTFUL_SNAG_FLAG, { snag: true });
}
