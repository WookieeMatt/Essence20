// Hot To Trot (Knights of Canterlot, Elementary Enchantment spell, p.43): "This warmth increases
// the pony's speed, allowing them to move 15ft further with each Movement action" for the spell's
// 1-scene duration. A flat on/off flag on whichever actor was targeted by the cast (read directly
// in documents/actor.mjs#_prepareMovement, the same generic per-actor flag shape Fluttery
// Wings/Lightning Speed already established for their own MLP CRB movement spells) - "1 scene" is
// approximated as "until toggled off," this project's usual duration idiom, since there's no
// scene-boundary hook to clear it automatically.

const HOT_TO_TROT_FLAG = 'hotToTrotActive';

export function isHotToTrotActive(actor) {
  return !!actor?.getFlag?.('essence20', HOT_TO_TROT_FLAG);
}

export async function applyHotToTrot(actor) {
  await actor.setFlag('essence20', HOT_TO_TROT_FLAG, true);
}

export async function removeHotToTrot(actor) {
  await actor.unsetFlag('essence20', HOT_TO_TROT_FLAG);
}
