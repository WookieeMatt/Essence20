import { bankPendingBonus } from "./perks.mjs";

/**
 * Psycho Strike (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, p.302): "Psycho Strike
 * (Might): +d4, Reach (Stun 1). Alternate Effects: 1 Blunt damage (↓1), Target suffers Snag on
 * their next attack." The Blunt/↓1 alternate was already built (Psycho Strike Alternate Effect,
 * jO2sdiGCutguWJlI) - this is the SECOND, previously-missing alternate: a plain-damage hit
 * (Stun 1, no shift penalty) that additionally banks Snag on the target, consumed by their own
 * next roll.
 *
 * Added as its own weaponEffect item (Psycho Strike Snag Effect,
 * packs/fmmcitems/_source/Psycho_Strike_Snag_Effect_Sq4EwIr6RIYmZ5K6.json) rather than a flag on
 * the existing Alternate Effect, since RAW lists these as two SEPARATE choices, not one combined
 * effect. Reuses Flying Nuisance's own bankPendingBonus/getPendingBonus "unscoped Snag, consumed
 * on next roll" idiom (helpers/flying-nuisance.mjs) - the closest existing mechanism to "their
 * next attack" this codebase has (it goes on ANY Skill Test, not attacks specifically, the same
 * approximation Flying Nuisance's own "Snag on Skill Tests" text already licenses).
 */
export const PSYCHO_STRIKE_SNAG_EFFECT_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.Sq4EwIr6RIYmZ5K6";
export const PSYCHO_STRIKE_SNAG_FLAG = 'pendingPsychoStrikeSnag';

/**
 * Banks the unscoped Snag on the target - see this file's own doc comment. Consumed in
 * dice.mjs's own unscoped-bonus block.
 * @param {Actor} targetActor
 */
export async function markPsychoStrikeSnag(targetActor) {
  await bankPendingBonus(targetActor, PSYCHO_STRIKE_SNAG_FLAG, { snag: true });
}
