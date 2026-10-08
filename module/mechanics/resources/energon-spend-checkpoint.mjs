/**
 * The Energon choke point: every write to system.energon.normal.value passes the actor update hooks; a decrease is a
 * spend unless the writer passes `{essence20Loss: true}` or `{essence20Refund: true}`. Item code joins it with
 * registerBeforeEnergonWrite (may adjust the write) and registerEnergonSpend (after a spend, on the writing client) -
 * Repair Progress's bonus point, items/resources/repair-progress-bonus-energon.mjs.
 *
 * Fuel Efficient (a d4 per Energon Point spent, a 4 gives it back) is its item's own resourceSpent
 * Trigger rule.
 */
import { changed } from "../../items/shared/resource-team-lookups.mjs";
import { onHook } from "../../items/shared/hooks-and-clients.mjs";
import { num } from "../../items/shared/numbers.mjs";

export const ENERGON = 'system.energon.normal.value';

const BEFORE_WRITE = [];
const ON_SPEND = [];

/** fn(actor, changes, next) before an Energon write, once the previous value is recorded. */
export const registerBeforeEnergonWrite = fn => BEFORE_WRITE.push(fn);

/** async fn(actor, previous) after an Energon spend; a rejection is logged. */
export const registerEnergonSpend = fn => ON_SPEND.push(fn);

/**
 * Whether an update is the sheet's Rest/Recharge (it resets every alternate strain at once).
 */
export function isRestUpdate(changes) {
  return changed(changes, 'system.energon.dark.value') !== undefined
    && changed(changes, 'system.energon.red.value') !== undefined
    && changed(changes, ENERGON) !== undefined;
}

/* -------------------------------------------- */
/*  Before / after an Energon write              */
/* -------------------------------------------- */

onHook('preUpdateActor', (actor, changes, options) => {
  const next = changed(changes, ENERGON);
  if (next === undefined) {
    return;
  }

  options.essence20PrevEnergon = num(actor.system?.energon?.normal?.value);
  for (const fn of BEFORE_WRITE) {
    fn(actor, changes, next);
  }
});

onHook('updateActor', (actor, changes, options, userId) => {
  const next = changed(changes, ENERGON);
  if (userId != game.user?.id || next === undefined || options?.essence20Refund || options?.essence20Loss
    || options?.essence20PrevEnergon === undefined || isRestUpdate(changes)) {
    return;
  }

  const spent = options.essence20PrevEnergon - num(next);
  if (spent > 0) {
    for (const fn of ON_SPEND) {
      fn(actor, options.essence20PrevEnergon).catch(error => console.error('Essence20 | Energon spend', error));
    }
  }
});
