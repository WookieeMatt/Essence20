/**
 * Repair Progress, 10 minutes or less (Cobra/Con Fusion, Table 1-1, p.10): every PC, G.I. Joes
 * too, gets 1 bonus Energon Point that may go over the maximum and is gone once spent. Kept as a Perk (the adventure's rewards are). Adding the Perk
 * gives the point; the point is the one above the maximum, so it is spent the moment Energon
 * drops from over the maximum, after which the Perk marks itself spent. A Rest (which caps Energon
 * at the maximum) leaves an unspent bonus point in place. The item that gives the point is the one with a BonusEnergon rule
 * (rules/plugins/combat/subsystem-readers.mjs) - this keeps the Energon cap / Rest / spend hooks that rule type needs.
 */
import { ENERGON_CAP_EXTRAS } from "../../mechanics/resources/temporary-resources.mjs";
import {
  ENERGON, isRestUpdate, registerBeforeEnergonWrite, registerEnergonSpend,
} from "../../mechanics/resources/energon-spend-checkpoint.mjs";
import { setChanged } from "../shared/resource-team-lookups.mjs";
import { bonusEnergonItems } from "../../rules/plugins/combat/subsystem-readers.mjs";
import { num } from "../shared/numbers.mjs";

const BONUS_SPENT_FLAG = 'repairBonusSpent';

/** The actor's (first) item with a BonusEnergon rule. */
const bonusItemOf = actor => bonusEnergonItems(actor)[0] ?? null;

export function repairBonusHeld(actor) {
  const perk = bonusItemOf(actor);
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
  const perk = bonusItemOf(actor);
  if (perk && !perk.flags?.essence20?.[BONUS_SPENT_FLAG] && prev > max) {
    await perk.setFlag('essence20', BONUS_SPENT_FLAG, true);
  }
});
