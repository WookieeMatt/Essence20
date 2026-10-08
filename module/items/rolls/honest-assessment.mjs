/**
 * Honest Assessment (MLP CRB, Spirit of Honesty, 14th level) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.honestAssessmentActive; dice.mjs reads it for the ↓2 on Deception and Persuasion; the Perk's ↑2 rule reads the flag.
 */
const FLAG = 'honestAssessmentActive';

export function isHonestAssessmentActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
