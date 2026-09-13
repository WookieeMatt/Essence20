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

export async function applyGlow(actor) {
  await actor.setFlag('essence20', GLOW_FLAG, true);
}

export async function removeGlow(actor) {
  await actor.unsetFlag('essence20', GLOW_FLAG);
}
