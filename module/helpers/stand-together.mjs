import { getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { applyHealSkillTestResult } from "./heal-skill-test.mjs";

/**
 * Stand Together (Transformers CRB, Field Commander, 18th level, p.65): "At 18th level, once per
 * scene, as a Standard action, you can make a DIF 15 Persuasion Skill Test. On a success, all
 * allies Repair 1 Damage. This is multiplied on a Critical Success or a high degree of success."
 *
 * Unlike Patch Up/Preventative Measures/Tough It Out (helpers/heal-skill-test.mjs's own primitive
 * - a player-chosen amount driving the DIF), this is a flat DIF 15 whose own DEGREE OF SUCCESS
 * multiplies a fixed amount across every ally at once - the same `multiplier` dice.mjs's own
 * results.map() already computes per roll (Devastating Strike/Powerful Suggestions' own "Critical
 * Success... multiplier >= 2" reading, see dice.mjs's own comments at that computation), applied
 * here to every nearby ally instead of a single damage target. Only shares
 * applyHealSkillTestResult (real Health, not Temp Health) from the shared primitive above.
 */
export const STAND_TOGETHER_ID = "Compendium.essence20.tf_crb.Item.IXJYw6NYiVv32krl";
const STAND_TOGETHER_SCENE_FLAG = 'standTogetherUsedThisScene';
const REPAIR_AMOUNT = 1;

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseStandTogether(actor) {
  return getUsesThisScene(actor, STAND_TOGETHER_SCENE_FLAG) < 1;
}

/**
 * Marks the scene used and triggers the flat DIF 15 Persuasion Skill Test.
 * @param {Actor} actor
 */
export async function activateStandTogether(actor) {
  if (!canUseStandTogether(actor)) {
    ui.notifications.warn(game.i18n.localize('E20.StandTogetherUnavailable'));
    return;
  }

  await markUsedThisScene(actor, STAND_TOGETHER_SCENE_FLAG);

  await actor._dice.rollSkill({
    skill: 'persuasion', essence: 'social', dif: '15', isStandTogether: true,
  }, actor);
}

/**
 * Applies the mass heal on a successful cast - every ally within reach of the actor's voice,
 * repairing REPAIR_AMOUNT Health each, scaled by the roll's own degree-of-success multiplier
 * (dice.mjs's own results[0].multiplier - see this file's own doc comment).
 * @param {Actor} actor
 * @param {Number} multiplier
 */
export async function applyStandTogetherHeal(actor, multiplier) {
  const allies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  const amount = REPAIR_AMOUNT * multiplier;
  for (const ally of allies) {
    await applyHealSkillTestResult(ally, amount);
  }
}
