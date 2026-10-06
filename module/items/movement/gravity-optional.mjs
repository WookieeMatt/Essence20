/**
 * Gravity Optional (WTNV Citizen's Guide, Blood Space War Veteran Focus) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.gravityOptionalActive; check:gravityOptional (essence20.mjs) reads it for the Perk's floating Aerial Movement.
 */
const FLAG = 'gravityOptionalActive';

export function isGravityOptionalActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
