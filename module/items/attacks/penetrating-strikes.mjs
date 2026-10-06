import { activateForRounds, isActiveForRounds } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Penetrating Strikes (Power Rangers Core Rulebook, Grid Power, p.100): "You can funnel raw
 * Morphin Grid energy into your hand to hand impacts. By spending 1 Power, you allow your Martial
 * Arts attacks to ignore armor bonuses to Toughness for 1 minute." Same one-way flag-activation
 * shape as items/attacks/augment-power-weapon.mjs (see its own doc comment for why this isn't a
 * Perk-style toggle) - the Power cost is already spent generically before onPowerUse ever runs.
 *
 * The ignore-armor half is read directly in dice.mjs's per-target checkEntries construction via
 * mechanics/combat/combat.mjs#getDefenseValue's existing `ignoreArmor` option (the same one Drilling Shot's
 * identical clause already uses), gated on the attack being a Martial Arts weaponEffect. The
 * minute is counted as ten rounds on the Scene Clock, same as Augment Power Weapon's.
 */
const PENETRATING_STRIKES_FLAG = 'penetratingStrikesActive';
// "For 1 minute" - ten 6-second rounds, on the Scene Clock (see augment-power-weapon.mjs).
const PENETRATING_STRIKES_ROUNDS = 10;

export function isPenetratingStrikesActive(actor) {
  return !!actor?.getFlag && isActiveForRounds(actor, PENETRATING_STRIKES_FLAG);
}

/**
 * Activates Penetrating Strikes, if it isn't already active. A no-op (returns false) if already
 * active, matching Speed Boost's own "second click does nothing further" shape.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function activatePenetratingStrikes(actor) {
  if (isPenetratingStrikesActive(actor)) {
    return false;
  }

  await activateForRounds(actor, PENETRATING_STRIKES_FLAG, PENETRATING_STRIKES_ROUNDS);
  return true;
}
