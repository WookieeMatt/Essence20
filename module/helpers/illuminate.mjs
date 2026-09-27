/**
 * Illuminate (Power Rangers Core Rulebook, Grid Power, p.100): "You can shine with the light of
 * righteousness. While Morphed, you may spend 1 Power to emanate bright light in a 30 foot radius
 * for 1 minute. While in effect, your Martial Arts attacks inflict energy damage." Same one-way
 * flag-activation shape as helpers/penetrating-strikes.mjs (its own doc comment explains why this
 * isn't a Perk-style toggle) - the Power cost and the light emanation itself (system.shape/radius,
 * already authored on the compendium item) are handled generically before onPowerUse ever runs.
 *
 * Only the damage-type override is built here: read in dice.mjs's own overriddenDamageType chain,
 * gated on the parent weapon's `martialArts` trait - the same "parent weapon has this trait" check
 * Penetrating Strikes' identical Martial Arts gate already uses (rather than the narrower "no
 * parent weapon" Unarmed-only proxy several OTHER entries in that chain use, since RAW here says
 * "Martial Arts attacks," not "unarmed attacks," and Martial Arts is a trait several actual weapon
 * items carry, e.g. the Dagger). The "emanate bright light" half needing to actually illuminate the
 * scene is not built - no other Power/Perk in this codebase places a real light source on the
 * token, this would be the first, and RAW's own radius/duration are already visible to a GM on the
 * Power's own sheet to narrate by hand.
 */
const ILLUMINATE_FLAG = 'illuminateActive';

export function isIlluminateActive(actor) {
  return !!actor.getFlag?.('essence20', ILLUMINATE_FLAG);
}

/**
 * Activates Illuminate, if it isn't already active. A no-op (returns false) if already active,
 * matching Penetrating Strikes/Speed Boost's own "second click does nothing further" shape.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether this call actually changed anything.
 */
export async function activateIlluminate(actor) {
  if (isIlluminateActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', ILLUMINATE_FLAG, true);
  return true;
}
