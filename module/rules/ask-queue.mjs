/**
 * One pick dialog at a time per actor (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.4, Perk choice P1).
 *
 * A batch create fires onCreateItem for every item at once (Commando's two Expertise at 1st level), so without this two
 * ChoiceSet dialogs would open together, each offering what the other is about to take. queueAsk runs `fn` after every
 * earlier ask queued for the same actor has finished - its options are worked out, the dialog answered and the pick
 * stored - so the next ask sees it. A failing ask doesn't block the ones behind it.
 *
 * Never queue from inside a queued ask for the same actor (it would wait for itself): the queued work makes items, it
 * doesn't wait for their own asks (their onCreateItem queues behind and runs next).
 *
 * Plain Node safe: no imports, no Foundry globals.
 */

const QUEUES = new Map();

/** The queue key for an actor (or an item off any actor). */
function keyOf(owner) {
  return owner?.uuid ?? owner?.id ?? owner ?? 'none';
}

/**
 * Run `fn` once the actor's earlier asks are done.
 * @param {Actor|Object|null} actor
 * @param {Function} fn   () => Promise
 * @returns {Promise<*>}  What fn resolves to (or its rejection).
 */
export function queueAsk(actor, fn) {
  const key = keyOf(actor);
  const before = QUEUES.get(key) ?? Promise.resolve();
  const run = before.then(() => fn());
  const tail = run.then(() => null, () => null);
  QUEUES.set(key, tail);
  tail.then(() => {
    if (QUEUES.get(key) === tail) {
      QUEUES.delete(key);
    }
  });
  return run;
}

/** Whether an actor has asks queued or running (tests, and a sheet that wants to wait). */
export function asksPending(actor) {
  return QUEUES.has(keyOf(actor));
}
