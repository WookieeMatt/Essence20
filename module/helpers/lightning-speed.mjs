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
 * rates," not just ground). "1 scene" has no active expiry hook - left set until manually cleared.
 */
const LIGHTNING_SPEED_FLAG = 'lightningSpeedActive';

export function isLightningSpeedActive(actor) {
  return !!actor.getFlag?.('essence20', LIGHTNING_SPEED_FLAG);
}

export async function applyLightningSpeed(targetActor) {
  await targetActor.setFlag('essence20', LIGHTNING_SPEED_FLAG, true);
}
