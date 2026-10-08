// Glittermane (Knights of Canterlot, Superior Utility spell, p.46): the sparkle makes the caster
// hard to look at - ↓1 on spells, ranged attacks and melee weapons aimed at them. A self-only on/off flag (cast on the caster, same shape as Glow), consumed
// reciprocally: whoever ATTACKS a Glittermane-active actor suffers ↓1, read directly in
// dice.mjs#_getAutomaticCombatModifiers's per-target block, isAttack-gated (unlike Glow's own
// unconditional Alertness check - Glittermane specifically names "spells, ranged attacks or melee
// weapons," i.e. Attacks only). "Trying to cover up or hide the sparkles is at -2" (a self-penalty
// on a Stealth-style Skill Test to conceal the glow) and the "glowing path"/illumination clauses
// are narrative flavor with no fixed numeric target, not built.
//
// "1 scene" duration: the flag is a Scene Clock window (scene-clock.mjs#activateForWindow), so it
// reads as expired once the GM starts a new scene - no sweep needed, and the spell can simply be
// cast again next scene.

import { isActiveForWindow } from "../../mechanics/resources/scene-clock.mjs";

const GLITTERMANE_FLAG = 'glittermaneActive';

export function isGlittermaneActive(actor) {
  return !!actor?.getFlag && isActiveForWindow(actor, GLITTERMANE_FLAG, 'scene');
}

export async function removeGlittermane(actor) {
  await actor.unsetFlag('essence20', GLITTERMANE_FLAG);
}
