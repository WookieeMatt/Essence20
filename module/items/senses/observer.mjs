/**
 * Observer (Through the Shattered Grid, Guardian of Eltar, 10th level) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.observerDisguiseActive; dice.mjs reads it for the Deception ↑2 and the Snag-to-↓2 checkbox; the Perk's incoming Technology Snag rule reads the flag.
 */
const FLAG = 'observerDisguiseActive';

export function isObserverDisguiseActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
