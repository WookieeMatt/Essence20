/**
 * Speed Boost (Power Rangers Core Rulebook, Grid Power, p.101) - the first Power wired through the
 * new helpers/power-use.mjs#onPowerUse dispatch, chosen as the proof-of-concept because the
 * compendium item already carries the correct pair of ActiveEffects (Ground Movement +10,
 * Initiative Edge) fully and correctly shaped, just sitting `disabled: true` - the same "looks
 * built but isn't" trap this project has hit repeatedly with Perks. Nothing needs inventing here,
 * only enabling.
 */

/**
 * Whether Speed Boost's own effects are currently switched on.
 * @param {Item} item   The Speed Boost Power item itself.
 * @returns {Boolean}
 */
export function isSpeedBoostActive(item) {
  return item.effects.size > 0 && item.effects.every(effect => !effect.disabled);
}

/**
 * Enables Speed Boost's own two ActiveEffects, if they aren't already on. A no-op (returns false)
 * if they're already active - the generic Power click flow spends this Power's cost on every
 * click regardless of state (see power-use.mjs's own doc comment for why this isn't a toggle), so
 * a second click while already active correctly does nothing further rather than erroring or
 * re-enabling redundantly.
 * @param {Item} item   The Speed Boost Power item itself.
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function applySpeedBoost(item) {
  if (isSpeedBoostActive(item)) {
    return false;
  }

  for (const effect of item.effects) {
    await effect.update({ disabled: false });
  }

  return true;
}
