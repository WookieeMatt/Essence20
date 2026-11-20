/**
 * Alt Modes on Vehicles and Zords (the world line's vehicleAltModes switch - mechanics/resources/line-profiles.mjs - or
 * the older Configure Settings > "Vehicles and Zords can have Alt Modes"; off in every book line): a
 * homebrew vehicle that changes shape - a car that becomes a jet, a Zord's beast and robot modes. It uses the
 * Transformers' own conversion (sheet-handlers/transformer-handler.mjs): Alt Mode items, the Transform button, Alt
 * Mode movement and size, mode-only weapons, the Alt Mode status and chat line.
 *
 * A Vehicle or Zord is NOT a Transformer: `system.canTransform` stays false, so nothing that means "a Cybertronian"
 * (Energon, Hardpoints, creature tags, joining a Combiner, Alt Mode passengers) applies to it. It can convert when the
 * setting is on and it holds an Alt Mode - dropping one on is all it takes. One already converted can always convert
 * back, even with the setting turned off since.
 *
 * Imports only custom-game-lines.mjs, whose imports are import-free (jest loads it without Foundry).
 */

import { actorRule, worldRule } from "../resources/custom-game-lines.mjs";

/** The older world setting (settings.js), still honoured: a world that turned it on before line switches keeps it. */
export const VEHICLE_ALT_MODES_SETTING = 'vehicleAltModes';

/** The actor types the setting lets convert. */
export const CONVERTING_TYPES = Object.freeze(['vehicle', 'zord']);

/**
 * Whether Vehicles and Zords may have Alt Modes: the line's switch - this actor's line (custom-game-lines.mjs#actorRule,
 * the GM's pick in a Crossover world), or the world's with no actor - or the older setting.
 * @param {Actor} [actor]
 * @returns {Boolean}
 */
export function vehicleAltModesOn(actor = null) {
  if (actor ? actorRule(actor, 'vehicleAltModes') : worldRule('vehicleAltModes')) {
    return true;
  }

  try {
    return !!globalThis.game?.settings?.get?.('essence20', VEHICLE_ALT_MODES_SETTING);
  } catch {
    return false;
  }
}

const altModesOf = actor => [...(actor?.items ?? [])].filter(item => item?.type == 'altMode');

/**
 * Whether this actor may hold Alt Modes at all: a Transformer, or a Vehicle / Zord in a world with the setting on.
 * @param {Actor} actor
 * @param {Boolean} [enabled]   The setting (read from the world when left out).
 * @returns {Boolean}
 */
export function canHoldAltModes(actor, enabled = vehicleAltModesOn(actor)) {
  if (actor?.system?.canTransform) {
    return true;
  }

  return CONVERTING_TYPES.includes(actor?.type) && !!enabled;
}

/**
 * Whether this actor has a Transform button: a Transformer; a Vehicle / Zord holding an Alt Mode with the setting on;
 * or a Vehicle / Zord in an Alt Mode right now (so it can always change back).
 * @param {Actor} actor
 * @param {Boolean} [enabled]
 * @returns {Boolean}
 */
export function canConvert(actor, enabled = vehicleAltModesOn(actor)) {
  if (actor?.system?.canTransform) {
    return true;
  }

  if (!CONVERTING_TYPES.includes(actor?.type)) {
    return false;
  }

  return !!actor.system?.isTransformed || (!!enabled && altModesOf(actor).length > 0);
}
