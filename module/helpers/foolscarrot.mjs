// Foolscarrot (Knights of Canterlot, Elementary Enchantment spell, p.42): "The target of this
// spell...suffers a downshift 3 to all Skill Tests that don't involve trying to claim [the
// illusion], due to their constant distraction." A flat on/off flag on whichever actor was
// targeted by the cast (same shape as Hot To Trot/Greased Lightning), read as an UNCONDITIONAL
// shiftDown-3 on every Skill Test - the "that don't involve trying to claim it" carve-out has no
// concrete Skill/Attack to exempt (chasing a spectral illusion isn't itself a Skill Test), so it's
// dropped as an accepted simplification, the same "grant/deny unconditionally, let the fiction
// justify the edge cases" idiom Fear My Name's own unenforceable "previously targeted" qualifier
// already uses. Duration is now tracked with the Scene Clock (helpers/scene-clock.mjs) - Elementary
// Enchantment spells in this book last 1 scene - so it clears once the GM calls the scene rather
// than lingering; the "DIF 10 Alertness Test to break out early" clause is dropped as unbuilt, the
// same "the concrete duration is tracked, an early-exit isn't" gap already accepted for Block
// Magic's own Snag-alternative.

import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

const FOOLSCARROT_FLAG = 'foolscarrotActive';

export function isFoolscarrotActive(actor) {
  return isActiveForWindow(actor, FOOLSCARROT_FLAG, 'scene');
}

export async function applyFoolscarrot(actor) {
  await activateForWindow(actor, FOOLSCARROT_FLAG, 'scene');
}

export async function removeFoolscarrot(actor) {
  await actor.unsetFlag('essence20', FOOLSCARROT_FLAG);
}
