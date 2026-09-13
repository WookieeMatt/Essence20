/**
 * Blazing Strikes (Across the Stars, Grid Power, p.72): "You may spend 1 Personal Power as a Free
 * action to have your unarmed strikes inflict Fire damage and gain 'Critical Effect: Next ally
 * gains upshift 2 against this foe' until the end of the scene."
 *
 * A one-way flag activation (no toggle-off), the same idiom helpers/augment-power-weapon.mjs's own
 * doc comment establishes for Powers generally - the generic Power click flow spends the cost
 * unconditionally on every click with no "this click means turn it back off" concept. Only the
 * damage-type-override half is built; the "Critical Effect" ally-buff half needs this project's
 * own `_isCritIsFumble` crit detection threaded to a NEW target-marking step this pass didn't
 * reach - flagged as a gap, not silently dropped.
 */
const BLAZING_STRIKES_FLAG = 'blazingStrikesActive';

export function isBlazingStrikesActive(actor) {
  return !!actor.getFlag?.('essence20', BLAZING_STRIKES_FLAG);
}

/**
 * Activates Blazing Strikes, if it isn't already active. A no-op (returns false) if already
 * active, matching Speed Boost's own "second click does nothing further" shape.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateBlazingStrikes(actor) {
  if (isBlazingStrikesActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', BLAZING_STRIKES_FLAG, true);
  return true;
}
