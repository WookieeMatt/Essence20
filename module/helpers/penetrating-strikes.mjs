/**
 * Penetrating Strikes (Power Rangers Core Rulebook, Grid Power, p.100): "You can funnel raw
 * Morphin Grid energy into your hand to hand impacts. By spending 1 Power, you allow your Martial
 * Arts attacks to ignore armor bonuses to Toughness for 1 minute." Same one-way flag-activation
 * shape as helpers/augment-power-weapon.mjs (see its own doc comment for why this isn't a
 * Perk-style toggle) - the Power cost is already spent generically before onPowerUse ever runs.
 *
 * The ignore-armor half is read directly in dice.mjs's per-target checkEntries construction via
 * helpers/combat.mjs#getDefenseValue's existing `ignoreArmor` option (the same one Drilling Shot's
 * identical clause already uses), gated on the attack being a Martial Arts weaponEffect.
 */
const PENETRATING_STRIKES_FLAG = 'penetratingStrikesActive';

export function isPenetratingStrikesActive(actor) {
  return !!actor.getFlag?.('essence20', PENETRATING_STRIKES_FLAG);
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

  await actor.setFlag('essence20', PENETRATING_STRIKES_FLAG, true);
  return true;
}
