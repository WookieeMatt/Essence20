import { activateForWindow, isActiveForWindow } from "./scene-clock.mjs";

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
 * just granted by someone ELSE's cast rather than the actor's own activation. "1 day" duration is
 * approximated to the current scene via the Scene Clock (helpers/scene-clock.mjs) - the coarsest
 * window this project tracks, since there's no separate day-length counter - so it now clears on
 * its own once the GM calls the scene, rather than sitting until someone remembers to remove it.
 */
const FLUTTERY_WINGS_FLAG = 'flutteryWingsActive';
const FLUTTERY_WINGS_BONUS_FEET = 15;

export function isFlutteryWingsActive(actor) {
  return isActiveForWindow(actor, FLUTTERY_WINGS_FLAG, 'scene');
}

export async function applyFlutteryWings(targetActor) {
  await activateForWindow(targetActor, FLUTTERY_WINGS_FLAG, 'scene');
}

export function getFlutteryWingsBonus(actor) {
  return isFlutteryWingsActive(actor) ? FLUTTERY_WINGS_BONUS_FEET : 0;
}
