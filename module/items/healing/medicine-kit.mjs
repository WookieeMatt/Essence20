import { activeKits } from "../../mechanics/resources/kits.mjs";

/**
 * Proper Protection (GI Joe CRB, Medic): "while you have a medicine kit" - its immunities (poison, disease, the
 * Poisoned Condition) are rules on its pack item, whose check:medicineKit asks hasMedicineKit (essence20.mjs).
 * Its crit note on curing poison is in the Heal action (mechanics/actions/heal-action.mjs).
 */

/** "while you have a medicine kit" - a carried Science (Medicine) kit. */
export function hasMedicineKit(actor) {
  return activeKits(actor).some(kit => kit.skill == 'science' && /medic/i.test(kit.spec ?? ''));
}
