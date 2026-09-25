import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

// Mystery Sense (Knights of Canterlot, Superior Enchantment spell, p.47): "gives you a +3 to your
// Alertness, Infiltration, and Streetwise skills to try to find [a hidden clue]" for the spell's
// 1-scene duration. A self-only on/off flag (same shape as Glow/Hot To Trot), read directly in
// dice.mjs#rollSkill's own shift computation for the 3 named skills - now tracked with the Scene
// Clock (helpers/scene-clock.mjs) so it clears once the GM calls the scene rather than lingering.
// "Once activated the spell lets you know if there is an important clue within your vicinity" (the
// detection half) isn't automated - this system has no environment/clue tracking anywhere (the
// same gap already blocking Danger Bell/Cozycoat/Pollution Solution/Waterrunning), so only the
// concrete +3 shiftUp is built here.

const MYSTERY_SENSE_FLAG = 'mysterySenseActive';

export function isMysterySenseActive(actor) {
  return isActiveForWindow(actor, MYSTERY_SENSE_FLAG, 'scene');
}

export async function applyMysterySense(actor) {
  await activateForWindow(actor, MYSTERY_SENSE_FLAG, 'scene');
}

export async function removeMysterySense(actor) {
  await actor.unsetFlag('essence20', MYSTERY_SENSE_FLAG);
}
