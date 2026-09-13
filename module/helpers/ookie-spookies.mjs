// Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50): "While you are not
// invisible, you are harder to see, granting you Edge on any Skill Tests to sneak about." A
// self-only on/off flag (same shape as Glow/Mystery Sense), read directly in dice.mjs#rollSkill's
// self-status section as Edge on Infiltration (this system's own "sneak about" skill). The
// "walk through walls/float through ceilings" clause (its own actual headline effect) isn't
// built - this system has no wall/terrain-collision model to grant an exception to, the same
// environment-tracking gap already blocking Cozycoat/Waterrunning/Cloud Art.

const OOKIE_SPOOKIES_FLAG = 'ookieSpookiesActive';

export function isOokieSpookiesActive(actor) {
  return !!actor?.getFlag?.('essence20', OOKIE_SPOOKIES_FLAG);
}

export async function applyOokieSpookies(actor) {
  await actor.setFlag('essence20', OOKIE_SPOOKIES_FLAG, true);
}

export async function removeOokieSpookies(actor) {
  await actor.unsetFlag('essence20', OOKIE_SPOOKIES_FLAG);
}
