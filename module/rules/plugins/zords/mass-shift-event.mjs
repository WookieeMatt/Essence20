import { registerEvent } from "../../types.mjs";

/**
 * Group H: Trigger event `massShiftUsed` - the Mass Shift Role Perk was used (items/forms/mass-shift.mjs#activateMassShift).
 */

registerEvent('massShiftUsed');

export async function massShiftUsed(actor) {
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'massShiftUsed');
}
