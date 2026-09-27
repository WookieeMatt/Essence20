// Glittermane (Knights of Canterlot, Superior Utility spell, p.46): "it makes you a little hard
// to look at, and all attempts to target you with spells, ranged attacks or melee weapons suffer
// ↓1." A self-only on/off flag (cast on the caster, same shape as Glow), consumed
// reciprocally: whoever ATTACKS a Glittermane-active actor suffers ↓1, read directly in
// dice.mjs#_getAutomaticCombatModifiers's per-target block, isAttack-gated (unlike Glow's own
// unconditional Alertness check - Glittermane specifically names "spells, ranged attacks or melee
// weapons," i.e. Attacks only). "Trying to cover up or hide the sparkles is at -2" (a self-penalty
// on a Stealth-style Skill Test to conceal the glow) and the "glowing path"/illumination clauses
// are narrative flavor with no fixed numeric target, not built.

const GLITTERMANE_FLAG = 'glittermaneActive';

export function isGlittermaneActive(actor) {
  return !!actor?.getFlag?.('essence20', GLITTERMANE_FLAG);
}

export async function applyGlittermane(actor) {
  await actor.setFlag('essence20', GLITTERMANE_FLAG, true);
}

export async function removeGlittermane(actor) {
  await actor.unsetFlag('essence20', GLITTERMANE_FLAG);
}
