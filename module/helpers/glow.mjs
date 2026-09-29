// Glow (Knights of Canterlot, Elementary Aid spell, p.42): "Casting this spell makes your...horn
// light up and glow...While active, anyone trying to spot you gains Edge, especially at night." A
// self-only on/off flag (no target - unlike Hot To Trot, this is cast on the caster themselves),
// consumed reciprocally: whoever rolls Alertness against a Glow-active actor gets Edge, read
// directly in dice.mjs#_getAutomaticCombatModifiers's per-target block, the same reciprocal shape
// Skepticism/See Something Say Nothing already established there, just helping the roller instead
// of hurting them. "You can extinguish it at will" is the same manual toggle-off idiom Fluttery
// Wings/Lightning Speed/Hot To Trot already use for their own MLP spell durations.

const GLOW_FLAG = 'glowActive';

export function isGlowActive(actor) {
  return !!actor?.getFlag?.('essence20', GLOW_FLAG);
}

// "the equivalent light of a lantern (light for about 20ft all around)" - on the caster's token, and
// put back the way it was when the spell ends.
const GLOW_LIGHT = { bright: 20, dim: 20 };

export async function applyGlow(actor) {
  const token = actor?.getActiveTokens?.()?.[0]?.document;
  const previous = token ? { bright: token.light?.bright ?? 0, dim: token.light?.dim ?? 0 } : null;
  await actor.setFlag('essence20', GLOW_FLAG, previous ?? true);
  if (token) {
    await token.update({ 'light.bright': GLOW_LIGHT.bright, 'light.dim': GLOW_LIGHT.dim });
  }
}

export async function removeGlow(actor) {
  const previous = actor?.getFlag?.('essence20', GLOW_FLAG);
  const token = actor?.getActiveTokens?.()?.[0]?.document;
  if (token && typeof previous == 'object') {
    await token.update({ 'light.bright': previous.bright ?? 0, 'light.dim': previous.dim ?? 0 });
  }

  await actor.unsetFlag('essence20', GLOW_FLAG);
}
