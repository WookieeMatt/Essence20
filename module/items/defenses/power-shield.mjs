/**
 * Power Shield (Power Rangers Core Rulebook, Grid Power, p.100): "By spending 1 Power to summon
 * the shield, granting the wielder a +2 armor bonus to Toughness. The shield is a physical object
 * that can be transferred to others, and lasts until you return to your normal form." Same
 * "enable this item's own already-correct but disabled ActiveEffect" shape as Speed Boost (see
 * that file's own doc comment) - the compendium item already carries a correct
 * system.defenses.toughness.morphed +2 effect (with a 10-round duration as this project's usual
 * "approximate the actual end condition" idiom for "until you un-Morph", since nothing here
 * tracks Morph-state transitions as an expiry trigger), just sitting disabled. The "can be
 * transferred to others" clause is left as pure narrative - no item-transfer mechanism exists
 * anywhere in this codebase (see the Automation Ledger's item-grant/equipment-mutation gap).
 */

/**
 * Whether Power Shield's own effect is currently switched on.
 * @param {Item} item   The Power Shield Power item itself.
 * @returns {Boolean}
 */
export function isPowerShieldActive(item) {
  return item.effects.size > 0 && item.effects.every(effect => !effect.disabled);
}

/**
 * Enables Power Shield's own ActiveEffect, if it isn't already on. A no-op (returns false) if
 * already active - the generic Power click flow spends this Power's cost on every click
 * regardless of state, so a second click while already active correctly does nothing further.
 * @param {Item} item   The Power Shield Power item itself.
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function applyPowerShield(item) {
  if (isPowerShieldActive(item)) {
    return false;
  }

  for (const effect of item.effects) {
    await effect.update({ disabled: false });
  }

  return true;
}
