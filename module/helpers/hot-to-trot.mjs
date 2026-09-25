import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

// Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43): "This warmth increases
// the pony's speed, allowing them to move 15ft further with each Movement action" for the spell's
// 1-scene duration. A flat on/off flag on whichever actor was targeted by the cast (read directly
// in documents/actor.mjs#_prepareMovement, the same generic per-actor flag shape Fluttery
// Wings/Lightning Speed already established for their own MLP CRB movement spells) - "1 scene" now
// clears on its own via the Scene Clock (helpers/scene-clock.mjs) once the GM calls the scene,
// rather than being left set until someone toggles it off by hand.

const HOT_TO_TROT_FLAG = 'hotToTrotActive';

export function isHotToTrotActive(actor) {
  return isActiveForWindow(actor, HOT_TO_TROT_FLAG, 'scene');
}

export async function applyHotToTrot(actor) {
  await activateForWindow(actor, HOT_TO_TROT_FLAG, 'scene');
}

export async function removeHotToTrot(actor) {
  await actor.unsetFlag('essence20', HOT_TO_TROT_FLAG);
}
