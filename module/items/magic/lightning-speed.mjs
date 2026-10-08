import { isActiveForWindow } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Lightning Speed (MLP CRB, Virtuoso Utility spell, p.139): a creature in range has every Movement
 * doubled for the spell's duration.
 *
 * Same flat-DIF non-Attack cast, flag-the-targeted-token-on-success shape as
 * Fluttery Wings/Healing Bandages/Enchant. Read live in
 * documents/actor.mjs#_prepareMovement as a final `*= 2` on every movement type, the same
 * doubling shape Warrior Rush/Quantum Master already established for a self-buff, just granted by
 * someone else's cast and applying to every movement type at once (RAW's own "all their Movement
 * rates," not just ground). "1 scene" is now tracked with the Scene Clock
 * (mechanics/resources/scene-clock.mjs) instead of a plain boolean, so it clears on its own once the GM calls
 * the scene rather than lingering until someone remembers to remove it.
 */
const LIGHTNING_SPEED_FLAG = 'lightningSpeedActive';

export function isLightningSpeedActive(actor) {
  return isActiveForWindow(actor, LIGHTNING_SPEED_FLAG, 'scene');
}

