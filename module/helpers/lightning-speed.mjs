import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

/**
 * Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139): "You experience a burst of speed...
 * Target any creature within range. That creature doubles all their Movement rates for the
 * duration of the spell."
 *
 * Same "flat-DIF non-Attack cast, apply a flag to whichever token is targeted on success" shape as
 * Fluttery Wings/Healing Bandages/Enchant. Read live in
 * documents/actor.mjs#_prepareMovement as a final `*= 2` on every movement type, the same
 * doubling shape Warrior Rush/Quantum Master already established for a self-buff, just granted by
 * someone else's cast and applying to every movement type at once (RAW's own "all their Movement
 * rates," not just ground). "1 scene" is now tracked with the Scene Clock
 * (helpers/scene-clock.mjs) instead of a plain boolean, so it clears on its own once the GM calls
 * the scene rather than lingering until someone remembers to remove it.
 */
const LIGHTNING_SPEED_FLAG = 'lightningSpeedActive';

export function isLightningSpeedActive(actor) {
  return isActiveForWindow(actor, LIGHTNING_SPEED_FLAG, 'scene');
}

export async function applyLightningSpeed(targetActor) {
  await activateForWindow(targetActor, LIGHTNING_SPEED_FLAG, 'scene');
}
