/**
 * The Tough Get Going (Factions in Action Vol. 2: Intercontinental Adventures, Oktober Guard
 * General Perk, p.95): "Once per round, if an Attack targeting your Toughness misses, you may
 * immediately Move your Ground Movement."
 *
 * A reciprocal trigger, but not the same "interrupt/react before resolution" shape this project's
 * still-missing reaction hook is blocked on (Fe-BURN!, Defender Step, etc.) - this reacts AFTER
 * the attack has already resolved as a miss, the same post-resolution write-a-flag-on-the-target
 * idiom Splinter Defense's own reciprocal Initiative dock already establishes (dice.mjs's own
 * post-roll results loop), just triggered by a miss instead of a hit. "Immediately Move your
 * Ground Movement" (an extra Move action's worth of movement, not a stat change) has no action-
 * economy concept to grant into, so it's approximated the same way Warrior Rush's own "double your
 * Movements" already is - doubling Ground Movement for the rest of the round it was triggered in,
 * gated once per round via hasUsedThisRound/markUsedThisRound (documents/actor.mjs#_prepareMovement
 * reads it the same way it reads Warrior Rush/Rush the Line's own round-scoped doubling).
 */

const ACTIVE_FLAG = 'theToughGetGoingActive';

/**
 * Grants the actor a doubled-Ground-Movement window for the rest of this round.
 * @param {Actor} actor
 */
export async function activateTheToughGetGoing(actor) {
  await actor.setFlag('essence20', ACTIVE_FLAG, { round: game.combat?.round ?? null });
}

/**
 * Whether the actor's doubled-Ground-Movement window is still active this round.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isTheToughGetGoingActive(actor) {
  const flag = actor.getFlag?.('essence20', ACTIVE_FLAG);
  return !!flag && flag.round === (game.combat?.round ?? null);
}
