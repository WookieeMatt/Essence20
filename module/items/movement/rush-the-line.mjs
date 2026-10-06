/**
 * Rush the Line (Factions in Action Vol. 2, Renegade Focus) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.rushTheLineActive; check:rushTheLine (essence20.mjs) reads it for the Perk's doubled ground Movement. The Use banks the melee Edge; a turnEnd Trigger clears the flag.
 */
const FLAG = 'rushTheLineActive';

export function isRushTheLineActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
