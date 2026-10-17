/**
 * Dig In (Enigma of Combination, Cannoneer Focus, Gunner, 17th level) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.cannoneerDugIn; check:cannoneerDugIn (essence20.mjs) reads it for the Perk's Cover rule, and its AimBonus rule reads the flag.
 */
const FLAG = 'cannoneerDugIn';

export function isCannoneerDugIn(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
