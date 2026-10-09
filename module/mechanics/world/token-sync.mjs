import { buildDetectionModes } from "../../items/senses/blindsight.mjs";

/**
 * Keeping an actor's placed tokens in step with it: size, image, and vision (sight and Blindsight).
 */

/**
 * Handle looking up tokens associated with actor and changing size
 * @param {Actor} actor  The actor
 * @param {Number} width The actor's new width
 * @param {Number} height The actor's new width
 */
export function resizeTokens(actor, width, height) {
  for (const token of sizedTokensOf(actor)) {
    if (token.width != width || token.height != height) {
      token.update({ height, width });
    }
  }
}

/**
 * The placed tokens an actor's Size governs: an unlinked token's own token when the actor is that token's copy; else
 * its linked tokens, and its unlinked tokens on every scene that don't keep a Size of their own (a token whose copy
 * changed its Size isn't this actor's to resize). Only tokens this user may change. Exported for tests.
 * @param {Actor} actor
 * @param {Iterable<Scene>} [scenes]
 * @returns {TokenDocument[]}
 */
export function sizedTokensOf(actor, scenes = globalThis.game?.scenes ?? []) {
  if (!actor) {
    return [];
  }

  if (actor.isToken) {
    return actor.token?.isOwner ? [actor.token] : [];
  }

  const found = new Set();
  for (const scene of scenes) {
    for (const token of scene.tokens ?? []) {
      // Only what the token itself overrides (its delta's stored data) - the delta's prepared system carries every field.
      const own = token.delta?._source?.system?.size;
      const ownSize = own !== undefined && own !== null;
      if (token.actorId == actor.id && token.isOwner && (token.actorLink || !ownSize)) {
        found.add(token);
      }
    }
  }

  return [...found];
}

/**
 * Changes the image for all tokens tied to the actor
 * @param {Actor} actor The actor who is changing
 * @param {String} newImage The location of the image file
 */
export function changeTokenImage(actor, newImage){
  // No art to switch to (a Morphed image or Alt Mode token image that was never set) - leave
  // the tokens as they are. Writing an empty path here used to blank every token and throw
  // "Requested texture path is empty" from the token animation, once per token, on every
  // morph and transform. mechanics/characters/morph-state.mjs tells the user the art is missing.
  if (!newImage) {
    return;
  }

  const tokens = actor?.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "texture.src": newImage,
    });
  }
}

/**
 * Pushes the actor's currently-computed vision grant (system.visionGrant, set by
 * Essence20Actor#_prepareVision()) onto every placed token and the actor's prototype token, so
 * items like Night Vision Goggles actually change what the token can see on a scene. Falls back
 * to the token's normal "basic" vision rather than force-disabling sight when no vision-granting
 * item is present, so a GM's own sight configuration isn't clobbered.
 *
 * Note this does NOT handle blocking vision outright for Blinded/Asleep/Unconscious - setting
 * TokenDocument.sight.enabled to false does not actually blank a token's perception the way
 * Foundry's own CONFIG.specialStatusEffects.BLIND handling does (confirmed by direct testing:
 * the "blinded" status, wired to BLIND in essence20.mjs, works; sight.enabled=false alone does
 * not). See ../combat/linked-status-sync.mjs#syncAutoBlindStatus, which reuses Foundry's real Blind status for that.
 * @param {Actor} actor The actor whose vision grant should be applied to its tokens
 */
export async function applyVisionToTokens(actor) {
  const grant = actor?.system?.visionGrant;
  const sight = grant
    ? { enabled: true, visionMode: grant.mode, range: grant.range }
    : { visionMode: "basic", range: 0 };

  // Blindsight rides along on the same update: it is a detectionModes entry rather than a
  // sight mode, and the two are independent (see items/senses/blindsight.mjs).
  const range = actor?.system?.blindsightRange ?? 0;

  const tokens = actor?.getActiveTokens() ?? [];
  for (const token of tokens) {
    await token.document.update({
      sight,
      detectionModes: buildDetectionModes(token.document.detectionModes, range),
    });
  }

  if (actor?.prototypeToken) {
    await actor.update({
      "prototypeToken.sight": sight,
      "prototypeToken.detectionModes": buildDetectionModes(actor.prototypeToken.detectionModes, range),
    });
  }
}
