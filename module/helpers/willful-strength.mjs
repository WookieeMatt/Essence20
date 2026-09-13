import { E20 } from "./config.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Willful Strength (A Jump Through Time, Grid Power, p.58): "You may spend 1 Personal Power at
 * the beginning of a scene to gain a number of bonus Health equal to the Ranks you possess in the
 * Survival Skill."
 *
 * This system tracks skill progression as a die shift (d2-d12), not a numeric "Ranks" count -
 * "Ranks" is approximated as the skill's own position in E20.skillRollableShifts (d2=0 up to
 * d12=5), the same ordered-list-index idiom `_getSizeShift`/skill-substitution mechanics already
 * use elsewhere in this project for a "how far along this ladder" number, since RAW's own "Ranks"
 * concept has no more literal equivalent in this data model. "At the beginning of a scene" is
 * gated the same once-per-encounter way this project's other scene-scoped grants already are -
 * the bonus Health itself is a plain additive system.health.bonus with no removal hook (no
 * scene-end hook exists anywhere in this codebase), the same "approximate, GM resets it manually
 * between scenes" idiom Dig In's own toggle already accepts.
 */
const WILLFUL_STRENGTH_ENCOUNTER_FLAG = 'willfulStrengthUsedThisEncounter';

/**
 * @param {Actor} actor
 * @returns {Number|null}   Bonus Health granted (0 if Unskilled at d2), or null if already used
 *   this scene.
 */
export async function activateWillfulStrength(actor) {
  if (hasUsedThisEncounter(actor, WILLFUL_STRENGTH_ENCOUNTER_FLAG)) {
    return null;
  }

  const survivalShift = actor.system.skills?.survival?.shift ?? 'd2';
  const bonusHealth = Math.max(0, E20.skillRollableShifts.indexOf(survivalShift));
  if (bonusHealth > 0) {
    await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + bonusHealth });
  }

  await markUsedThisEncounter(actor, WILLFUL_STRENGTH_ENCOUNTER_FLAG);
  return bonusHealth;
}
