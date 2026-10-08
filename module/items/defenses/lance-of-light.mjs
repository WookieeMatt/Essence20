/**
 * Lance of Light (A Jump Through Time, General Perk) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.lanceOfLightActive; dice.mjs reads it for the Energy Resistance it gives (a Resistance Snag on attackers), and the Perk's own rules read the flag.
 */
const FLAG = 'lanceOfLightActive';

export function isLanceOfLightActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
