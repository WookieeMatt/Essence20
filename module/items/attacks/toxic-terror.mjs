import { activateForWindow, getUses, isActiveForWindow, markUsed } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level, p.300): "Spend 1
 * Personal Power as a Free action to grant all your unarmed attacks the Alternate Effect: impose
 * a downshift (stacking, +1 per application) to the target's Strength- and Speed-based Skill
 * Tests, until the end of the scene. This benefit to your attacks lasts until the end of the
 * scene."
 *
 * Both halves last "until the end of the scene", and both are stored as scene-clock window
 * records (mechanics/resources/scene-clock.mjs), so both end on their own when the GM starts a new scene:
 * - the activation on the user (activateForWindow/isActiveForWindow), which the Use button can
 *   still switch back off early;
 * - the stacking downshift on each target, a per-scene use count (markUsed/getUses) - each unarmed
 *   hit adds one, and a new scene reads it as zero again.
 * Records written before this (a bare `true` / a bare number) carry no epoch, so they read as
 * expired - the safe direction to fail, since they used to never end at all.
 */
const TOXIC_TERROR_ACTIVE_FLAG = 'toxicTerrorActive';
const TOXIC_TERROR_STACKS_FLAG = 'toxicTerrorStacks';
const ACTIVATION_COST = 1;

export function isToxicTerrorActive(actor) {
  return !!actor && isActiveForWindow(actor, TOXIC_TERROR_ACTIVE_FLAG, 'scene');
}

/**
 * Flips the actor's own Toxic Terror stance. Turning it ON spends 1 Personal Power and lasts for
 * the rest of the scene; turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state, or null if activation couldn't be afforded.
 */
export async function toggleToxicTerror(actor) {
  const nowActive = !isToxicTerrorActive(actor);
  if (!nowActive) {
    await actor.setFlag('essence20', TOXIC_TERROR_ACTIVE_FLAG, false);
    return false;
  }

  if ((actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
    return null;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST });
  await activateForWindow(actor, TOXIC_TERROR_ACTIVE_FLAG, 'scene');
  return true;
}

/**
 * The target's stacked downshift from this scene's Toxic Terror hits.
 * @param {Actor} targetActor
 * @returns {Number}
 */
export function getToxicTerrorShiftDown(targetActor) {
  return targetActor ? getUses(targetActor, TOXIC_TERROR_STACKS_FLAG, 'scene') : 0;
}

/**
 * Adds one more stacking point to the target's own downshift, for the rest of the scene.
 * @param {Actor} targetActor
 */
export async function addToxicTerrorStack(targetActor) {
  await markUsed(targetActor, TOXIC_TERROR_STACKS_FLAG, { window: 'scene' });
}
