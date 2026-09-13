import { bankPendingBonus } from "./perks.mjs";

/**
 * Repair Machine (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "When you
 * activate this power, some nanomites leave your body to repair a piece of broken equipment
 * within 10 feet of you. As the nanomites follow your direction, you gain Edge on Technology Skill
 * Tests to fix the broken equipment."
 *
 * A plain self-banked Edge scoped to the Technology skill specifically, consumed on the actor's
 * own next Technology roll (this project's usual "approximate a task-scoped duration as the next
 * matching roll" idiom) - same shape as Grid Surge's own skill-scoped Temporary Construct, just a
 * fixed skill rather than a player choice, and free (no cost exists to charge here, same
 * untracked-daily-use gap as this book's other nanomite powers).
 */
export const REPAIR_MACHINE_EDGE_FLAG = 'pendingRepairMachineEdge';

export async function activateRepairMachine(actor) {
  await bankPendingBonus(actor, REPAIR_MACHINE_EDGE_FLAG);
}
