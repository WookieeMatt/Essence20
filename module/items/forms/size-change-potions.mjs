import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { activateForWindow, isActiveForWindow } from "../../mechanics/resources/scene-clock.mjs";

// Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (Knights of Canterlot, Magic
// Baubles, p.52): "turns any creature who drinks it into a Huge [or Tiny] creature for 1 scene...
// Nothing changes (such as stats or spells) except your size." Same self-only "save the original
// size, then restore it" idiom items/magic/scarefying-appearance.mjs already established for Scarefying
// Appearance, generalized here (rather than copy-pasted per potion) since both potions are the
// identical shape and only differ in which fixed size they set: a single flag storing which potion
// is active AND the size it overwrote, so either one can be undone regardless of which was drunk.
//
// This project's E20.actorSizes ladder (config.mjs) has no "Tiny" category below its own smallest,
// "Small" - Petite Pony's Shrink Drink is approximated onto "Small" rather than inventing a new
// rung under it, the same kind of ladder-approximation Scarefying Appearance's own "step up one
// size category" already accepts.
//
// "1 scene": drinking also stamps a Scene Clock 'scene' window (scene-clock.mjs), and the active
// GM's client reverts the size when the GM starts a new scene (the essence20.sceneAdvanced hook at
// the bottom of this file). A client that missed that - the GM was offline, or the drinker is a
// token actor on a scene nobody was viewing - still can't get stuck: drinking another potion
// after the scene has ended reverts the stale one first, instead of refusing.
//
// "Your equipment does not expand/shrink with you" is narrative and not enforced - a token's own
// size still shows the change, which is the mechanically relevant half.

const SIZE_CHANGE_POTION_FLAG = 'sizeChangePotionOriginalSize';
const SIZE_CHANGE_POTION_SCENE_FLAG = 'sizeChangePotionScene';

export function isSizeChangePotionActive(actor) {
  return actor?.getFlag?.('essence20', SIZE_CHANGE_POTION_FLAG) !== undefined;
}

/**
 * Whether an active potion's scene has already ended (or it was drunk before potions had a
 * duration at all), so it should be reverted.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isSizeChangePotionExpired(actor) {
  return isSizeChangePotionActive(actor) && !isActiveForWindow(actor, SIZE_CHANGE_POTION_SCENE_FLAG, 'scene');
}

/**
 * Applies a size-change potion's effect, saving the actor's current size so it can be restored
 * later. A no-op if one of these potions is already active this scene (can't be both Huge and
 * Tiny at once); one left over from an earlier scene is reverted first.
 * @param {Actor} actor
 * @param {String} targetSize   An E20.actorSizes key, e.g. 'huge' or 'small'.
 */
export async function applySizeChangePotion(actor, targetSize) {
  if (isSizeChangePotionExpired(actor)) {
    await removeSizeChangePotion(actor);
  }

  if (isSizeChangePotionActive(actor)) {
    return;
  }

  await actor.setFlag('essence20', SIZE_CHANGE_POTION_FLAG, actor.system.size);
  await activateForWindow(actor, SIZE_CHANGE_POTION_SCENE_FLAG, 'scene');
  await actor.update({ 'system.size': targetSize });
}

export async function removeSizeChangePotion(actor) {
  const originalSize = actor.getFlag('essence20', SIZE_CHANGE_POTION_FLAG);
  if (originalSize !== undefined) {
    await actor.update({ 'system.size': originalSize });
  }

  await actor.unsetFlag('essence20', SIZE_CHANGE_POTION_FLAG);
  await actor.unsetFlag('essence20', SIZE_CHANGE_POTION_SCENE_FLAG);
}

/**
 * Every actor a timed size change could be sitting on: the world's actors, plus the unlinked
 * token actors on each scene (those aren't in game.actors).
 * @returns {Array<Actor>}
 */
export function sizeChangeCandidates() {
  const actors = [...worldActors()];
  for (const scene of globalThis.game?.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.push(token.actor);
      }
    }
  }

  return actors;
}

/**
 * Reverts every potion whose scene has ended. Active GM only, so nothing is written twice.
 * @returns {Promise<void>}
 */
export async function expireSizeChangePotions() {
  if (!globalThis.game?.users?.activeGM?.isSelf) {
    return;
  }

  for (const actor of sizeChangeCandidates()) {
    if (isSizeChangePotionExpired(actor)) {
      await removeSizeChangePotion(actor);
    }
  }
}

globalThis.Hooks?.on?.('essence20.sceneAdvanced', () => expireSizeChangePotions());
