/**
 * "Infiltrating" (Shadow and Silent Strider, GI Joe CRB Infiltrator Focus) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.infiltratingActive; check:infiltrating (essence20.mjs) reads it for Shadow's switch; Silent Strider's rule reads the flag. Either Perk switches it.
 */
const FLAG = 'infiltratingActive';

export function isInfiltrating(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
