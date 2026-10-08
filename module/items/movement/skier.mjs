/**
 * Skier (General Hawk's Personnel Files, General Perk) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.isSkiingActive; check:skiing (essence20.mjs) reads it for the Perk's Movement and Evasion rules.
 */
const FLAG = 'isSkiingActive';

export function isSkiing(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
