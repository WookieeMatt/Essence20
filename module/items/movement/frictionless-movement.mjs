/**
 * Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk) - its on / off switch is a Use rule on the item (rules/conv17-split3.test.js), writing the actor flag
 * flags.essence20.frictionlessMovementActive; check:frictionlessMovement (essence20.mjs) reads it for the Perk's doubled-Movement rule. A turnEnd Trigger clears it.
 */
const FLAG = 'frictionlessMovementActive';

export function isFrictionlessMovementActive(actor) {
  return !!actor?.getFlag?.('essence20', FLAG);
}
