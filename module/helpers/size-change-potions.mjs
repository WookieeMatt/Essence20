// Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (Knights of Canterlot, Magic
// Baubles, p.52): "turns any creature who drinks it into a Huge [or Tiny] creature for 1 scene...
// Nothing changes (such as stats or spells) except your size." Same self-only "save the original
// size, then restore it" idiom helpers/scarefying-appearance.mjs already established for Scarefying
// Appearance, generalized here (rather than copy-pasted per potion) since both potions are the
// identical shape and only differ in which fixed size they set: a single flag storing which potion
// is active AND the size it overwrote, so either one can be undone regardless of which was drunk.
//
// This project's E20.actorSizes ladder (config.mjs) has no "Tiny" category below its own smallest,
// "Small" - Petite Pony's Shrink Drink is approximated onto "Small" rather than inventing a new
// rung under it, the same kind of ladder-approximation Scarefying Appearance's own "step up one
// size category" already accepts.
//
// The "1 scene" duration isn't auto-expired - like Scarefying Appearance's own identical
// removeScarefyingAppearance, there is no scene-end hook in this codebase to revert an arbitrary
// actor flag automatically, so reverting is left as a manual, GM/player-triggered undo (same
// unenforced-duration idiom used broadly elsewhere in this codebase, e.g. Reckless Abandon).
//
// "Your equipment does not expand/shrink with you" is narrative and not enforced - a token's own
// size still shows the change, which is the mechanically relevant half.

const SIZE_CHANGE_POTION_FLAG = 'sizeChangePotionOriginalSize';

export function isSizeChangePotionActive(actor) {
  return actor?.getFlag?.('essence20', SIZE_CHANGE_POTION_FLAG) !== undefined;
}

/**
 * Applies a size-change potion's effect, saving the actor's current size so it can be restored
 * later. A no-op if one of these potions is already active (can't be both Huge and Tiny at once).
 * @param {Actor} actor
 * @param {String} targetSize   An E20.actorSizes key, e.g. 'huge' or 'small'.
 */
export async function applySizeChangePotion(actor, targetSize) {
  if (isSizeChangePotionActive(actor)) {
    return;
  }

  await actor.setFlag('essence20', SIZE_CHANGE_POTION_FLAG, actor.system.size);
  await actor.update({ 'system.size': targetSize });
}

export async function removeSizeChangePotion(actor) {
  const originalSize = actor.getFlag('essence20', SIZE_CHANGE_POTION_FLAG);
  if (originalSize !== undefined) {
    await actor.update({ 'system.size': originalSize });
  }

  await actor.unsetFlag('essence20', SIZE_CHANGE_POTION_FLAG);
}
