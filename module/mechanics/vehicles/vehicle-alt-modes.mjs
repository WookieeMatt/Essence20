/**
 * Alt Modes on Vehicles and Zords (Configure Settings > "Vehicles and Zords can have Alt Modes", off by default): a
 * homebrew vehicle that changes shape - a car that becomes a jet, a Zord's beast and robot modes. It uses the
 * Transformers' own conversion (sheet-handlers/transformer-handler.mjs): Alt Mode items, the Transform button, Alt
 * Mode movement and size, mode-only weapons, the Alt Mode status and chat line.
 *
 * A Vehicle or Zord is NOT a Transformer: `system.canTransform` stays false, so nothing that means "a Cybertronian"
 * (Energon, Hardpoints, creature tags, joining a Combiner, Alt Mode passengers) applies to it. It can convert when the
 * setting is on and it holds an Alt Mode - dropping one on is all it takes. One already converted can always convert
 * back, even with the setting turned off since.
 *
 * Import-free (jest loads it without Foundry).
 */

/** The world setting (settings.js). */
export const VEHICLE_ALT_MODES_SETTING = 'vehicleAltModes';

/** The actor types the setting lets convert. */
export const CONVERTING_TYPES = Object.freeze(['vehicle', 'zord']);

/** Whether the world lets Vehicles and Zords have Alt Modes. */
export function vehicleAltModesOn() {
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
export function canHoldAltModes(actor, enabled = vehicleAltModesOn()) {
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
export function canConvert(actor, enabled = vehicleAltModesOn()) {
  if (actor?.system?.canTransform) {
    return true;
  }

  if (!CONVERTING_TYPES.includes(actor?.type)) {
    return false;
  }

  return !!actor.system?.isTransformed || (!!enabled && altModesOf(actor).length > 0);
}
