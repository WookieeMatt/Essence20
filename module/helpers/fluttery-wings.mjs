/**
 * Fluttery Wings (MLP CRB, Elementary Aid spell, p.136): "You gift grounded creatures with
 * beautiful wings... The target creature grows wings like a butterfly, gaining 15ft Aerial
 * movement."
 *
 * Cast against the spell's own flat casting DIF (Elementary = Routine/10, entered manually the
 * same way every non-Attack spell cast already works - same shape as Healing Bandages/Enchant).
 * On a successful cast, sets a flag on whichever token is currently targeted (or the caster
 * themselves with nothing targeted) - read live in documents/actor.mjs#_prepareMovement (the one
 * permitted movement-math touch-point), the same shape Mobile Mode/Swiftness already established,
 * just granted by someone ELSE's cast rather than the actor's own activation. "1 day" duration has
 * no active expiry hook - left set until manually cleared, this project's usual approximation for
 * a duration this system can't literally track.
 */
const FLUTTERY_WINGS_FLAG = 'flutteryWingsActive';
const FLUTTERY_WINGS_BONUS_FEET = 15;

export function isFlutteryWingsActive(actor) {
  return !!actor.getFlag?.('essence20', FLUTTERY_WINGS_FLAG);
}

export async function applyFlutteryWings(targetActor) {
  await targetActor.setFlag('essence20', FLUTTERY_WINGS_FLAG, true);
}

export function getFlutteryWingsBonus(actor) {
  return isFlutteryWingsActive(actor) ? FLUTTERY_WINGS_BONUS_FEET : 0;
}
