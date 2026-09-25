import { hasUsedThisRound, markUsedThisRound } from "./perks.mjs";

/**
 * On Target (MLP CRB, Influence Perk, p.46): "Once per round, you can spend a Free action to use
 * Targeting to perform a simple task from a distance of up to 60 feet."
 *
 * The Perk's own compendium item already carries actionType: 'free', which is what surfaces its
 * "Use" button on the Actions tab (helpers/action-economy.mjs#getActionsTabContext) and spends the
 * Free action - but clicking it did nothing beyond that. This triggers the actual Targeting Skill
 * Test (the same actor._dice.rollSkill(...) + isXAttempt dispatch shape helpers/humanitarian.mjs's
 * own doc comment establishes), gated once per round on top of the Free-action cost the sheet
 * already enforces. "A distance of up to 60 feet" is an unenforced range qualifier on the
 * task itself, not on anything targetable in this codebase.
 */
export const ON_TARGET_ID = "Compendium.essence20.mlp_crb.Item.sTEcpoI5UTnGn01U";

const ON_TARGET_ROUND_FLAG = 'onTargetUsedThisRound';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseOnTarget(actor) {
  return !hasUsedThisRound(actor, ON_TARGET_ROUND_FLAG);
}

/**
 * Rolls the Targeting Skill Test and marks the round used.
 * @param {Actor} actor
 */
export async function activateOnTarget(actor) {
  await markUsedThisRound(actor, ON_TARGET_ROUND_FLAG);
  await actor._dice.rollSkill({ skill: 'targeting', essence: 'speed', shiftUp: 0, shiftDown: 0 }, actor);
}
