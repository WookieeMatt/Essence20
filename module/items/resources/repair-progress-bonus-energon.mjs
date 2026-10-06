/**
 * Repair Progress, 10 minutes or less (Cobra/Con Fusion, Table 1-1, p.10): "All PCs, including
 * G.I. Joes, gain 1 bonus Energon Point. This can exceed their normal Energon point maximum, but
 * once spent, can't be regained." Kept as a Perk (the adventure's rewards are). Adding the Perk
 * gives the point; the point is the one above the maximum, so it is spent the moment Energon
 * drops from over the maximum, after which the Perk marks itself spent. A Rest (which caps Energon
 * at the maximum) leaves an unspent bonus point in place.
 */
import { ENERGON_CAP_EXTRAS } from "../../mechanics/resources/temporary-resources.mjs";
import {
  ENERGON, isRestUpdate, registerBeforeEnergonWrite, registerEnergonSpend,
} from "../../mechanics/resources/energon-spend-checkpoint.mjs";
import { IDS, setChanged } from "../shared/resource-team-lookups.mjs";
import { findSourced as findItem } from "../shared/item-lookups.mjs";
import { num } from "../shared/numbers.mjs";

const BONUS_SPENT_FLAG = 'repairBonusSpent';

export function repairBonusHeld(actor) {
  const perk = findItem(actor, IDS.repairProgressEnergon);
  return perk && !perk.flags?.essence20?.[BONUS_SPENT_FLAG] ? 1 : 0;
}

ENERGON_CAP_EXTRAS.push(repairBonusHeld);

// Adding the Perk gives the point: its own 'added' Trigger rule (gainResource with overMax).

registerBeforeEnergonWrite((actor, changes, next) => {
  const max = num(actor.system?.energon?.normal?.max);
  // Rest caps Energon at the maximum; an unspent bonus point rides on top of it.
  if (isRestUpdate(changes) && repairBonusHeld(actor) && num(next) <= max) {
    setChanged(changes, ENERGON, num(next) + 1);
  }
});

registerEnergonSpend(async (actor, prev) => {
  const max = num(actor.system?.energon?.normal?.max);
  const perk = findItem(actor, IDS.repairProgressEnergon);
  if (perk && !perk.flags?.essence20?.[BONUS_SPENT_FLAG] && prev > max) {
    await perk.setFlag('essence20', BONUS_SPENT_FLAG, true);
  }
});
