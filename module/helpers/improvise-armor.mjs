import { getEngineOverrideTarget } from "./engine-override.mjs";

/**
 * Improvise Armor (Factions in Action Vol. 2: Intercontinental Adventures, Engineer Troop Focus,
 * 3rd level, p.73): "Once per scene as a Standard action, you can augment the chassis of a
 * vehicle within your reach, including a vehicle you are riding in or driving. Roll a Technology
 * Skill Test. You grant the vehicle an amount of temporary Health equal to your result minus 10,
 * divided by 5. This temporary Health lasts until the end of the scene, or once lost."
 *
 * This is the first Perk in this project to scale a grant off the raw numeric TOTAL of a Skill
 * Test roll, rather than a pass/fail outcome against a Defense or flat DIF (every prior "trigger a
 * real roll" Power/Perk - Bolster Defense, Jury Rig, Absolute Menace, etc. - keys off
 * `results[0]?.success`). `_rollSkillHelper`'s own `roll.total` (the same variable its own
 * Degrees-of-Success multiplier computation already reads) is directly in scope wherever its
 * post-roll processing runs, so this doesn't actually need any new plumbing - it reads `roll.total`
 * straight from there instead of gating on success at all. A `dif` of 1 is still passed (any real
 * roll total is >= 1, and `computeMultiplier` returns 0 for a falsy/zero DIF) purely so the roll
 * has a normal-looking chat card entry to compare against - the actual grant never checks whether
 * that trivial comparison passed.
 *
 * Target resolution reuses helpers/engine-override.mjs's own getEngineOverrideTarget, the same
 * "within reach" shape Engine Override/Jury Rig (this same book) already established. "Temporary
 * Health" is `system.health.bonus`, the same field Boosted Vigor/Roadside Assistant's own
 * Temp-Health grants already use - a plain actor.update(), not a change to `_prepareHealth`.
 * "Until the end of the scene" has no active clearing hook (this codebase has no scene-boundary
 * event) - the same "approximate an unenforceable duration, GM manages the edges" idiom Bolster
 * Defense's own identical "until end of scene" clause already uses; "or once lost" is naturally
 * handled by however this engine already consumes bonus Health on damage, no new logic needed.
 */

const ENCOUNTER_FLAG = 'improviseArmorUsedThisEncounter';

/**
 * Resolves the target vehicle and triggers the Technology roll. The actual temp Health grant only
 * happens afterward, in dice.mjs's own post-roll processing.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>}   The vehicle targeted, or null if there was nothing valid to
 *   target (surfaced as a warning by the caller).
 */
export async function activateImproviseArmor(actor) {
  const vehicle = getEngineOverrideTarget(actor);
  if (!vehicle) {
    return null;
  }

  await actor._dice.rollSkill({
    skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '1',
    isImproviseArmorAttempt: true, improviseArmorTargetUuid: vehicle.uuid,
  }, actor);
  return vehicle;
}

/**
 * Grants the vehicle temporary Health equal to floor((rollTotal - 10) / 5), floored at 0 (never a
 * negative grant on a poor roll) - called from dice.mjs's own post-roll processing.
 * @param {Actor} vehicle
 * @param {Number} rollTotal
 * @returns {Promise<Number>}   The amount actually granted.
 */
export async function applyImproviseArmor(vehicle, rollTotal) {
  const tempHealth = Math.max(0, Math.floor((rollTotal - 10) / 5));
  if (tempHealth > 0) {
    await vehicle.update({ 'system.health.bonus': (vehicle.system.health.bonus ?? 0) + tempHealth });
  }

  return tempHealth;
}

export { ENCOUNTER_FLAG as IMPROVISE_ARMOR_ENCOUNTER_FLAG };
