/**
 * Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.sprinterBoostActive; check:sprinterBoost (essence20.mjs) reads it for the Perk's Movement rules. A turnEnd Trigger clears it.
 */
const FLAG = 'sprinterBoostActive';

export function isSprinterBoostActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
