import { pickEltarianMettleCondition } from "./eltarian-mettle.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Nu, Pogodi! (Factions in Action Vol. 2, Oktober Guard Faction Perk, p.68): "Remove one Condition
 * (except Defeated) as a Free action, once per mission."
 *
 * Identical exclusion set (Defeated only) and identical self-targeted dynamic-option-list shape as
 * helpers/eltarian-mettle.mjs's own "As a Free action, spend 1 Personal Power to remove one
 * Condition (other than Defeated) from yourself" - unlike Inspiring Words/Balance and Harmony
 * (which each differ from Eltarian Mettle in a real way - ally-targeted, or a wider exclusion set,
 * respectively), there's no meaningful difference here to justify a separate picker, so this
 * reuses pickEltarianMettleCondition directly. "Once per mission" has no matching frequency bucket
 * anywhere in this codebase (see perfect-disguise.mjs's own identical finding) - approximated down
 * to once per encounter, the same idiom already established for other "once per Mission" Perks.
 */
const NU_POGODI_CONDITION_ENCOUNTER_FLAG = 'nuPogodiConditionUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseNuPogodiCondition(actor) {
  return !hasUsedThisEncounter(actor, NU_POGODI_CONDITION_ENCOUNTER_FLAG);
}

/**
 * Prompts for and removes one of the actor's own active Conditions, once per encounter.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The Condition actually removed, or null if not usable, nothing
 *   to remove, or the picker was cancelled.
 */
export async function applyNuPogodiCondition(actor) {
  if (!canUseNuPogodiCondition(actor)) {
    return null;
  }

  const condition = await pickEltarianMettleCondition(actor);
  if (!condition) {
    return null;
  }

  await actor.toggleStatusEffect(condition, { active: false });
  await markUsedThisEncounter(actor, NU_POGODI_CONDITION_ENCOUNTER_FLAG);
  return condition;
}
