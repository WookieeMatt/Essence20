// Block Magic (Knights of Canterlot, Virtuoso Enchantment spell, p.49): "you block their access
// to magical power for the duration of the spell. This means they must increase the cost of any
// spell they cast by an additional 1 or suffer Snag on the casting test." A flat on/off flag on
// the TARGET (banked on a successful hit, same shape as Hot To Trot/Foolscarrot), read directly
// in documents/item.mjs's own generic spell-casting-cost computation - the one place EVERY spell
// cast already computes its own cost, so this needed no new per-spell hook at all. Only the
// "+1 to casting cost" half is built - "or suffer Snag on the casting test instead" would need a
// new Roll Options Dialog checkbox specifically for spell casts (a real, distinct piece of new UI
// this project doesn't have - every existing checkbox is Perk- or item-specific, not "any spell
// this actor casts"), so the cost increase is applied unconditionally as the simpler of the two
// RAW options, the same "pick the concretely-buildable option, flag the rest" idiom this project
// already uses for Whatever Helps/Personal Sacrifice's own unautomated halves. "For the duration of
// the spell" (1 scene) is now tracked with the Scene Clock (helpers/scene-clock.mjs) so it clears
// once the GM calls the scene rather than being left applied until manually removed.

import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

const BLOCK_MAGIC_FLAG = 'blockMagicActive';

export function isBlockMagicActive(actor) {
  return isActiveForWindow(actor, BLOCK_MAGIC_FLAG, 'scene');
}

export async function applyBlockMagic(actor) {
  await activateForWindow(actor, BLOCK_MAGIC_FLAG, 'scene');
}

export async function removeBlockMagic(actor) {
  await actor.unsetFlag('essence20', BLOCK_MAGIC_FLAG);
}
