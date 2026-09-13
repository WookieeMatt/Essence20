import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { getSkillRanks } from "./combat.mjs";
import { isGmConnected, hasStoryPointsAvailable, requestStoryPointSpend } from "./story-points.mjs";

/**
 * I Still Function! (Decepticon Directive, General Perk, p.66): "Once per scene, when you are
 * Defeated, you can spend a Story Point and roll 1d6. If the result is equal to or lower than your
 * levels in the Conditioning skill, you immediately regain the result in Health and are no longer
 * Defeated."
 *
 * Same once-per-encounter-while-Defeated shape as GI Joe CRB's own Self-Revive
 * (helpers/self-revive.mjs), but gated on a real Story Point spend and a real 1d6-vs-Conditioning-
 * Skill-Ranks check rather than an unconditional success - getSkillRanks() (helpers/combat.mjs)
 * already derives "Skill Ranks" from the actor's own skill die/Specialization, the same formula
 * Bulked Up Frame's identical clause already established.
 */
const I_STILL_FUNCTION_ENCOUNTER_FLAG = 'iStillFunctionUsedThisEncounter';

/**
 * Whether I Still Function! can actually be used right now.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseIStillFunction(actor) {
  return !!actor.statuses?.has('defeated')
    && !hasUsedThisEncounter(actor, I_STILL_FUNCTION_ENCOUNTER_FLAG)
    && isGmConnected() && hasStoryPointsAvailable(1);
}

/**
 * Spends the Story Point, rolls 1d6 against the actor's own Conditioning Skill Ranks, and on
 * success regains that much Health and clears Defeated. Marks the encounter used either way -
 * RAW's own "once per scene" caps the ATTEMPT, not just a success.
 * @param {Actor} actor
 */
export async function activateIStillFunction(actor) {
  requestStoryPointSpend(actor, 1);
  await markUsedThisEncounter(actor, I_STILL_FUNCTION_ENCOUNTER_FLAG);

  const roll = await new Roll('1d6').evaluate();
  if (roll.total <= getSkillRanks(actor, 'conditioning')) {
    await actor.update({ 'system.health.value': roll.total });
    await actor.toggleStatusEffect('defeated', { active: false });
  }
}
