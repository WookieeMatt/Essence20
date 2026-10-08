import { getSceneEpoch } from "../resources/scene-clock.mjs";

/* -------------------------------------------- */
/*  Resistances for the rest of the scene        */
/* -------------------------------------------- */

// Hardened Armor (Across the Stars, Gold Ranger, p.52: "for the remainder of the scene") and the
// Grid Power Elemental Adaptation (Across the Stars, p.72: "to your Morphed form until the end of
// the scene") grant a Resistance that ends with the scene. They're kept here, stamped with the
// Scene Clock's scene counter, rather than written into system.resistances (which would never
// clear): documents/actor.mjs#_prepareSceneResistances folds the current scene's ones back into
// system.resistances during data prep, so a new scene ends them on its own.
export const SCENE_RESISTANCES_FLAG = 'sceneResistances';

/**
 * Grant a Resistance until the end of the current scene.
 * @param {Actor} actor
 * @param {String} damageType
 * @param {Object} [options]
 * @param {Boolean} [options.morphedOnly]   Only while the actor is Morphed.
 */
export async function grantSceneResistance(actor, damageType, { morphedOnly = false } = {}) {
  await actor.setFlag('essence20', `${SCENE_RESISTANCES_FLAG}.${damageType}`, {
    epoch: getSceneEpoch(), window: 'scene', count: 1, morphedOnly,
  });
}

/**
 * The damage types an actor is Resistant to for the rest of this scene.
 * @param {Actor} actor
 * @returns {String[]}
 */
export function sceneResistancesOf(actor) {
  const records = actor?.flags?.essence20?.[SCENE_RESISTANCES_FLAG] ?? {};
  const epoch = getSceneEpoch();
  return Object.entries(records)
    .filter(([, record]) => record?.epoch === epoch && (!record.morphedOnly || !!actor.system?.isMorphed))
    .map(([damageType]) => damageType);
}

/**
 * Clears expired scene Resistances when the GM starts a new scene, so every client re-prepares
 * the actors that had one (the settings change alone doesn't re-run their data prep).
 */
export async function clearSceneResistances() {
  const actors = [...(game.actors ?? [])];
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.push(token.actor);
      }
    }
  }

  for (const actor of actors) {
    if (actor.flags?.essence20?.[SCENE_RESISTANCES_FLAG]) {
      await actor.unsetFlag('essence20', SCENE_RESISTANCES_FLAG);
    }
  }
}

globalThis.Hooks?.on?.('essence20.sceneAdvanced', () => clearSceneResistances());
