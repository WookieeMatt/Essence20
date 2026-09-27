// Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50): "While you are not
// invisible, you are harder to see, granting you Edge on any Skill Tests to sneak about." A
// self-only on/off flag (same shape as Glow/Mystery Sense), read directly in dice.mjs#rollSkill's
// self-status section as Edge on Infiltration (this system's own "sneak about" skill). The
// "walk through walls/float through ceilings" clause (its own actual headline effect) isn't
// built - this system has no wall/terrain-collision model to grant an exception to, the same
// environment-tracking gap already blocking Cozycoat/Waterrunning/Cloud Art. Duration is now
// tracked with the Scene Clock (helpers/scene-clock.mjs), the same "for the scene" window every
// other Virtuoso/Superior Enchantment spell in this book uses, so it clears once the GM calls the
// scene rather than lingering; only the caster is affected here (RAW also extends this to "3
// willing ponies within Reach," which has no target-selection UI yet - flagged, not built).

import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

const OOKIE_SPOOKIES_FLAG = 'ookieSpookiesActive';

export function isOokieSpookiesActive(actor) {
  return isActiveForWindow(actor, OOKIE_SPOOKIES_FLAG, 'scene');
}

export async function applyOokieSpookies(actor) {
  await activateForWindow(actor, OOKIE_SPOOKIES_FLAG, 'scene');
}

export async function removeOokieSpookies(actor) {
  await actor.unsetFlag('essence20', OOKIE_SPOOKIES_FLAG);
}
