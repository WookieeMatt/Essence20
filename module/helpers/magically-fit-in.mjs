import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Mystical Understanding's own Magically Fit In (spend Mystical Points, pick the Skill) is a Use + RollModifier
 * rule on the Perk now (a counted `magicallyFitIn` mark for the scene - rules/conv12-slI12.test.js). What stays
 * here is the flag Friendship Is Mystical (extensions/mlp2) writes on a friend, read by dice.mjs.
 *
 * Mystical Understanding - Magically Fit In (MLP CRB, Spirit of Magic, 1st level, p.93): "You
 * gain ranks in a skill related to where you are or who you're with. For example, if you are at
 * a gym, you could spend Mystical Points to gain ranks in Athletics. The number of ranks you gain
 * is equal to the amount of Mystical Points you spend. These ranks last for the rest of the
 * scene."
 *
 * RE-CATEGORIZED - the ledger's blanket "Spellcasting mastery/rank tracking" tag was only ever
 * true for 3 of Mystical Understanding's 5 benefits (Refocus/Spellcosting/Essential Research -
 * Spellcialize is a DialogSwitch rule on the Perk). Magically Fit In needs none of that - "ranks"
 * here just means a shiftUp on a chosen Skill, the same currency Awesome/Spared No Expense's own
 * permanent shiftUp already uses, just player-picked at USE time (not build time) and scoped to
 * the rest of the current scene instead of forever. "Related to where you are or who you're with"
 * is the same unenforceable narrative-scoping qualifier this project already drops for Bits To
 * Spare/Truthseeker - the player picks any skill, self-policing the fictional trigger.
 *
 * Only the MOST RECENT activation is tracked (a single {skill, amount} flag, overwritten by a
 * later use) rather than stacking multiple simultaneously-boosted skills - the same "closest
 * deterministic approximation, not a full ledger" idiom Fortify's own single-Defense-choice flag
 * already established. "For the rest of the scene" is the Scene Clock's scene window: the flag
 * carries the scene epoch it was set in, and the bonus reads as zero once the GM starts a new
 * scene (a flag with no epoch reads as expired, the same way scene-clock.mjs's isActiveForWindow
 * treats one).
 */
const MAGICALLY_FIT_IN_FLAG = 'magicallyFitInBonus';

/**
 * The flag value that banks `amount` ranks on `skill` for the rest of the current scene. Shared
 * with Friendship Is Mystical (extensions/mlp2), which writes it onto a friend.
 * @param {String} skill
 * @param {Number} amount
 * @returns {{skill: String, amount: Number, epoch: Number}}
 */
export function magicallyFitInValue(skill, amount) {
  return { skill, amount, epoch: getSceneEpoch() };
}

/**
 * Live, non-consumed read for dice.mjs's own self-status shiftUp computation. Zero once the scene
 * the ranks were gained in has ended.
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @returns {Number}
 */
export function getMagicallyFitInBonus(actor, rolledSkill) {
  const bonus = actor?.getFlag?.('essence20', MAGICALLY_FIT_IN_FLAG);
  return bonus?.skill == rolledSkill && bonus.epoch === getSceneEpoch() ? bonus.amount : 0;
}
