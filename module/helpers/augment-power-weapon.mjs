/**
 * Augment Power Weapon (Power Rangers Core Rulebook, Grid Power, p.99): "Your summoned Power
 * Weapon is a stronger conduit of your Morphin Grid energy. You may spend 1 Power to enhance the
 * accuracy of your Power Weapon by upshift 1 for 1 minute." The Power cost is already spent
 * generically by sheet-handlers/power-handler.mjs#powerCost before onPowerUse ever runs - this is
 * a one-way flag activation, not a Perk-style on/off toggle, matching the same reasoning
 * helpers/speed-boost.mjs's own doc comment already spells out for exactly this situation
 * (there's no "this click means turn it back off" concept in the generic Power click flow, so a
 * second click while already active correctly does nothing rather than re-spending or erroring).
 * "For 1 minute" is approximated as "until a GM manually clears it" - this project's usual
 * duration idiom for anything longer than a single roll with no expiry hook to attach to.
 *
 * The upshift itself is read directly in dice.mjs's shift-computation block, gated on the attack's
 * parent weapon carrying the `powerWeapon` trait - the same trait check Power Boost/Red Ranger
 * Prime's identical clauses already use.
 */
const AUGMENT_POWER_WEAPON_FLAG = 'augmentPowerWeaponActive';

export function isAugmentPowerWeaponActive(actor) {
  return !!actor.getFlag?.('essence20', AUGMENT_POWER_WEAPON_FLAG);
}

/**
 * Activates Augment Power Weapon, if it isn't already active. A no-op (returns false) if already
 * active, matching Speed Boost's own "second click does nothing further" shape.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function activateAugmentPowerWeapon(actor) {
  if (isAugmentPowerWeaponActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', AUGMENT_POWER_WEAPON_FLAG, true);
  return true;
}
