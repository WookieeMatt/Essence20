/**
 * The tf2 slice's Use buttons.
 *
 * - Deconstruct is a Use rule on its Perk (rules/conv10-slC10.test.js); the Repair button on the item it sabotaged
 *   (any item carrying the flag) is here.
 * - Determine Probability, Energon Bank, Applied Science and Duke It Out are Use rules on their pack items.
 * - We Are One! picks its team and Skills with an item rule (rules/conv10-slE10.test.js), and a picked-scope Reroll
 *   rule gives the team the reroll (rules/ext/i/scopes.mjs - rules/conv12-slI12.test.js).
 * - Diversion and Cage are rules on their items (rules/conv10-slC10.test.js).
 * (Mutant Beast's second Alt Mode is an item rule - rules/conv10-slE10.test.js.)
 */
import { registerUse } from "../../extensions.mjs";
import { T } from "./common.mjs";
import { DECONSTRUCTED } from "./rolls.mjs";

async function grants() {
  return import("../../grants.mjs");
}

/* -------------------------------------------- */
/*  Repairing what Deconstruct broke             */
/* -------------------------------------------- */

async function repair(item) {
  const record = item.flags?.essence20?.[DECONSTRUCTED];
  const actor = item.parent;
  const { rollTest } = await grants();
  const { success } = await rollTest(actor, 'technology', record?.dif ?? 10);
  if (!success) {
    return T('Tf2RepairFailed', { name: actor.name, item: item.name });
  }

  await item.unsetFlag('essence20', DECONSTRUCTED);
  return T('Tf2Repaired', { name: actor.name, item: item.name });
}

/* -------------------------------------------- */
/*  The buttons                                  */
/* -------------------------------------------- */

export const USES = [
  {
    // Repairing what Deconstruct broke.
    id: 'tf2Repair', matches: item => !!item?.flags?.essence20?.[DECONSTRUCTED],
    run: repair,
  },
];

USES.forEach(registerUse);
