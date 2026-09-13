import { actorHasPerk } from "./perks.mjs";
import { isImmuneToCondition } from "./condition-immunity.mjs";

/**
 * Terror (Beneath the Helmet, Dark Ranger, 1st level, p.39): "You gain 1 Terror whenever you deal
 * damage or inflict a Condition on another character as a result of a Skill Test you have Edge on
 * (provided they aren't immune to being Frightened). You can carry a maximum amount of Terror
 * equal to [Terror Capacity]... You can spend any amount of accrued Terror to deal the same number
 * of additional points of damage on your Attacks."
 *
 * Terror Capacity (the actual point pool) is an ordinary scaling `rolePoints` item, already read
 * generically via the same `actor._getBaseRolePoints()` lookup Idea Points/Grid Surges/etc. use -
 * "Terror" itself is a separate, bare `perk` item that just grants access to the mechanic.
 *
 * The accrual half is checked from two call sites (both gated on wasEdge and the target not being
 * Frightened-immune): dice.mjs#_rollSkillHelper's own post-hit loop, for any successful attack
 * that actually deals damage (the common case), and Menacing Glare/Absolute Menace's own
 * Frightened-application (a Skill Test that inflicts a Condition without necessarily dealing any
 * damage - RAW's other trigger clause). "Losing all accrued Terror at the start of a new day" has
 * no active enforcement - no day-boundary hook exists anywhere in this codebase (the same gap
 * every other "per day" resource in this system already lives with, e.g. Idea Points/Grid Surges'
 * own daily refresh is manual too).
 */
const TERROR_ID = "Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd";

// Apex Dark Ranger (20th level, p.40): "...you no longer need to have Edge to accumulate Terror
// from your targets." A one-line bypass of grantTerrorIfEligible's own wasEdge gate below - the
// other half of Apex Dark Ranger (a Morph-time choice between a flight-movement grant and a
// damage-Resistance-ignore effect) is a genuinely separate, larger dual-mechanic feature, left as
// a documented gap rather than rushed in alongside this small tweak.
const APEX_DARK_RANGER_ID = "Compendium.essence20.beneath_the_helmet.Item.GJCOxtuot74Jnfs4";

export function hasTerror(actor) {
  return actorHasPerk(actor, TERROR_ID);
}

/**
 * The actor's own currently-accrued Terror (0 if they don't hold the Perk at all).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getTerrorAvailable(actor) {
  if (!hasTerror(actor)) {
    return 0;
  }

  return actor._getBaseRolePoints?.()?.system.resource.value ?? 0;
}

/**
 * Grants 1 Terror if every condition is met - called once per qualifying event (a single Attack
 * roll that both deals damage AND inflicts a Condition still only grants 1, since each call site
 * only fires for its own half; in practice a given roll only ever triggers from one call site).
 * @param {Actor} actor   The one who might accrue Terror.
 * @param {Actor} target   Who they affected - checked for Frightened immunity.
 * @param {Boolean} wasEdge   Whether the triggering Skill Test was rolled with Edge - bypassed
 *   entirely for an actor holding Apex Dark Ranger (20th level), see its own comment above.
 */
export async function grantTerrorIfEligible(actor, target, wasEdge) {
  const edgeSatisfied = wasEdge || actorHasPerk(actor, APEX_DARK_RANGER_ID);
  if (!edgeSatisfied || !target || !hasTerror(actor) || isImmuneToCondition(target, 'frightened')) {
    return;
  }

  const terrorCapacity = actor._getBaseRolePoints?.();
  if (!terrorCapacity) {
    return;
  }

  const newValue = Math.min(terrorCapacity.system.resource.max, terrorCapacity.system.resource.value + 1);
  await terrorCapacity.update({ 'system.resource.value': newValue });
}

/**
 * Spends the given amount of accrued Terror (capped at what's actually available, so a caller
 * that already read getTerrorAvailable() first never needs to re-clamp itself).
 * @param {Actor} actor
 * @param {Number} amount
 */
export async function spendTerror(actor, amount) {
  const terrorCapacity = actor._getBaseRolePoints?.();
  if (!terrorCapacity || amount <= 0) {
    return;
  }

  const newValue = Math.max(0, terrorCapacity.system.resource.value - amount);
  await terrorCapacity.update({ 'system.resource.value': newValue });
}
