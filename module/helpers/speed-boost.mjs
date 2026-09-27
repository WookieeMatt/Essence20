/**
 * Speed Boost (Power Rangers Core Rulebook, Grid Power, p.101). Two separate clauses:
 *
 * - "While Morphed, your Ground Movement rate is increased by 10 feet." Passive - the item's own
 *   "Speed Boost Ground" ActiveEffect writes system.movement.ground.morphed, which only counts
 *   while Morphed (documents/actor.mjs), so that effect simply belongs switched on. Activating the
 *   Power switches it on if the compendium copy still has it disabled.
 * - "Additionally, you can spend 1 Power to gain Edge on an Initiative Skill Test." One test per
 *   Power spent, so activating the Power banks a single Initiative Edge that
 *   dice.mjs#prepareInitiativeRoll consumes - the same declare-then-consume shape as Relic Key
 *   (helpers/relic-key.mjs). The item's old always-on "Initiative Edge" effect is never enabled
 *   here, since that would grant the Edge on every Initiative roll for free.
 */

const SPEED_BOOST_INITIATIVE_EDGE_FLAG = 'speedBoostInitiativeEdge';
const GROUND_MOVEMENT_KEY_PREFIX = 'system.movement.';

// The passive Ground Movement effect(s) - anything on the item that changes a Movement field.
function getMovementEffects(item) {
  return [...(item?.effects ?? [])].filter(effect =>
    (effect.changes ?? []).some(change => change.key?.startsWith(GROUND_MOVEMENT_KEY_PREFIX)));
}

/**
 * Whether a Speed Boost Initiative Edge is banked, waiting for the actor's next Initiative roll.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isSpeedBoostEdgeActive(actor) {
  return !!actor?.getFlag?.('essence20', SPEED_BOOST_INITIATIVE_EDGE_FLAG);
}

/**
 * Clears the banked Edge once an Initiative roll has used it.
 * @param {Actor} actor
 */
export async function consumeSpeedBoostEdge(actor) {
  await actor.unsetFlag?.('essence20', SPEED_BOOST_INITIATIVE_EDGE_FLAG);
}

/**
 * Activating the Power (after its 1 Power has been spent): banks one Initiative Edge, and makes
 * sure the passive Ground Movement effect is on. A no-op (returns false) if an Edge is already
 * banked, so a second click before rolling doesn't announce a second Edge that can't stack.
 * @param {Actor} actor   The actor activating the Power.
 * @param {Item} item   The Speed Boost Power item itself.
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function applySpeedBoost(actor, item) {
  for (const effect of getMovementEffects(item)) {
    if (effect.disabled) {
      await effect.update({ disabled: false });
    }
  }

  if (!actor || isSpeedBoostEdgeActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', SPEED_BOOST_INITIATIVE_EDGE_FLAG, true);
  return true;
}
