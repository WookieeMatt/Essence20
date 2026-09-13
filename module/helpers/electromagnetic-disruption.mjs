import { getNearbyEnemyTokens } from "./enemies.mjs";
import { applyDamage } from "./combat.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Electromagnetic Disruption (Technorganic Secrets, Technorganic Influence Perks, p.47) - see
 * E20.electromagneticDisruptionOptions' own doc comment. Only the 'pulse' option is built:
 * "once per day, send a 15ft electromagnetic pulse dealing 1 Electromagnetic damage and 1 Stun to
 * [nearby enemies]." Auto-hit (no roll named in RAW, unlike every other AoE this project has
 * built) - a plain damage application to every nearby enemy, "once per day" approximated as
 * "once per scene" (this project's usual idiom for a daily resource this codebase has no
 * day-boundary hook for).
 */
const PULSE_ENCOUNTER_FLAG = 'electromagneticDisruptionPulseUsedThisEncounter';
const PULSE_RADIUS_FEET = 15;

/**
 * @param {Actor} actor
 * @returns {Boolean}   Whether the pulse can still be used this scene.
 */
export function canUseElectromagneticDisruptionPulse(actor) {
  return !hasUsedThisEncounter(actor, PULSE_ENCOUNTER_FLAG);
}

/**
 * Deals 1 Electromagnetic damage and 1 Stun to every nearby enemy, once per scene.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False if already used this scene.
 */
export async function activateElectromagneticDisruptionPulse(actor) {
  if (!canUseElectromagneticDisruptionPulse(actor)) {
    return false;
  }

  for (const token of getNearbyEnemyTokens(actor, PULSE_RADIUS_FEET)) {
    if (token.actor) {
      await applyDamage(token.actor, 1, 'emp');
      await applyDamage(token.actor, 1, 'stun');
    }
  }

  await markUsedThisEncounter(actor, PULSE_ENCOUNTER_FLAG);
  return true;
}
