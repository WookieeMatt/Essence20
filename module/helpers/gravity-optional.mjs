import { getEffectiveLevel } from "./combat.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Gravity Optional (WTNV Citizen's Guide, Soldier Role, Blood Space War Veteran Focus, p.37):
 * "You can overcome gravity's pull when you leap, tripling the result of an Athletics Skill Test
 * to jump. In addition, you can float up to five feet in the air for up to 10 minutes once per
 * scene. This increases by five feet and five minutes every five levels."
 *
 * The jump-distance-tripling half isn't automated - this system has no jump-distance mechanic at
 * all to triple (an Athletics Skill Test's own numeric result isn't otherwise consumed by
 * anything). The floating half is an on/off toggle (like Power Boost's own isPowerBoostActive/
 * togglePowerBoost), gated on hasUsedThisEncounter to switch ON (once per scene) but free to
 * switch back OFF - the same "approximate duration, don't hard-enforce the 10-minute window"
 * idiom this project already accepts for Dig In/Got To Get Tough. Read in
 * documents/actor.mjs#_prepareMovement (the one permitted movement-math touch-point), overriding
 * aerial Movement to 5 feet + 5 more for every 5 character levels (getEffectiveLevel, this
 * project's own PC-Level/NPC-Threat-Level equivalence).
 */
const GRAVITY_OPTIONAL_FLAG = 'gravityOptionalActive';
const GRAVITY_OPTIONAL_ENCOUNTER_FLAG = 'gravityOptionalUsedThisEncounter';

export function isGravityOptionalActive(actor) {
  return !!actor.getFlag?.('essence20', GRAVITY_OPTIONAL_FLAG);
}

/**
 * How high (in feet) this actor's own Gravity Optional float currently reaches - see this file's
 * own doc comment above.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getGravityOptionalHeight(actor) {
  return 5 + 5 * Math.floor(getEffectiveLevel(actor) / 5);
}

/**
 * Flips the actor's own Gravity Optional float. Turning it ON is gated once per scene (returns
 * null, changing nothing, if already used this scene); turning it back OFF is always free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now floating), or null if activation
 *   was attempted but already used this scene.
 */
export async function toggleGravityOptional(actor) {
  const nowActive = !isGravityOptionalActive(actor);
  if (nowActive) {
    if (hasUsedThisEncounter(actor, GRAVITY_OPTIONAL_ENCOUNTER_FLAG)) {
      return null;
    }

    await markUsedThisEncounter(actor, GRAVITY_OPTIONAL_ENCOUNTER_FLAG);
  }

  await actor.setFlag('essence20', GRAVITY_OPTIONAL_FLAG, nowActive);
  return nowActive;
}
