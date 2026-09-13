import { E20 } from "./config.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Spot Weld (Decepticon Directive, General Perk, p.67): "Once per scene, you can spend an Energon
 * Point and attempt a DIF 12 Technology (Repair) Skill Test to repair 1 Health to a target within
 * reach. If you use this ability on yourself, you suffer Snag. If you have at least +d6 in
 * Technology, you can instead attempt a DIF 17 Technology (Repair) Skill Test to repair 2 Health."
 *
 * A flat-DIF Technology roll (not vs. a target's Defense), the same `dif`-driven shape Watchful
 * Eyes/Jury Rig already establish - target resolution ("within reach") reuses Comic Flair's own
 * "currently-targeted token, range-checked at click time, self as the trivial in-range case"
 * idiom. The heal itself is applied in dice.mjs's own post-hit processing, reading the target back
 * via a synthetic dataset UUID field the exact same way Jury Rig's own vehicle target already is.
 * The self-Snag clause is threaded through as its own dataset flag, consumed in rollSkill()'s
 * self-status section right alongside every other Perk-driven skillDataset.snag override.
 */

const SPOT_WELD_ENCOUNTER_FLAG = 'spotWeldUsedThisEncounter';
const REACH_FEET = 5;
const HIGH_TECH_SHIFT = 'd6';
const LOW_DIF = 12;
const LOW_HEAL = 1;
const HIGH_DIF = 17;
const HIGH_HEAL = 2;

/**
 * Whether Spot Weld can actually be used right now - not yet used this scene, and an Energon
 * Point is available to spend.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseSpotWeld(actor) {
  return !hasUsedThisEncounter(actor, SPOT_WELD_ENCOUNTER_FLAG)
    && actor.system.energon?.normal?.value > 0;
}

/**
 * The currently-targeted token's actor if it's within reach, else the actor themselves (a
 * self-heal is trivially "within reach"). Null if a token IS targeted but it's out of range.
 * @param {Actor} actor
 * @returns {Actor|null}
 */
export function resolveSpotWeldTarget(actor) {
  const targetToken = game.user.targets.first();
  if (!targetToken) {
    return actor;
  }

  const actorToken = actor?.getActiveTokens?.()?.[0];
  if (targetToken === actorToken) {
    return actor;
  }

  if (!actorToken || !canvas?.grid) {
    return null;
  }

  const distance = canvas.grid.measurePath([targetToken.center, actorToken.center]).distance;
  return distance <= REACH_FEET ? targetToken.actor : null;
}

/**
 * Whether the actor has at least +d6 in Technology (the higher-DIF/bigger-heal escalation's own
 * gate) - a smaller die further along E20.skillShiftList's own best-to-worst ordering.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasHighTechnology(actor) {
  const shiftIndex = E20.skillShiftList.indexOf(actor.system.skills?.technology?.shift);
  return shiftIndex >= 0 && shiftIndex <= E20.skillShiftList.indexOf(HIGH_TECH_SHIFT);
}

/**
 * Spends the Energon Point, marks the scene used, and triggers the real DIF 12/17 Technology
 * (Repair) roll against whichever target was resolved.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>}   The resolved target, or null if there was nothing in reach to
 *   target (surfaced as a warning by the caller) - nothing is spent in that case.
 */
export async function activateSpotWeld(actor) {
  const target = resolveSpotWeldTarget(actor);
  if (!target) {
    return null;
  }

  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await markUsedThisEncounter(actor, SPOT_WELD_ENCOUNTER_FLAG);

  const isHighTech = hasHighTechnology(actor);
  await actor._dice.rollSkill({
    skill: 'technology', essence: 'smarts', shiftUp: 0, shiftDown: 0,
    dif: String(isHighTech ? HIGH_DIF : LOW_DIF),
    isSpotWeldAttempt: true,
    spotWeldTargetUuid: target.uuid,
    spotWeldHealAmount: isHighTech ? HIGH_HEAL : LOW_HEAL,
    isSpotWeldSelfHeal: target === actor,
  }, actor);

  return target;
}

/**
 * Heals the resolved target by the rolled amount, capped at their own max Health - called from
 * dice.mjs's own post-roll success handling.
 * @param {Actor} targetActor
 * @param {Number} healAmount
 */
export async function applySpotWeldHeal(targetActor, healAmount) {
  await targetActor.update({
    'system.health.value': Math.min(targetActor.system.health.max, targetActor.system.health.value + healAmount),
  });
}
