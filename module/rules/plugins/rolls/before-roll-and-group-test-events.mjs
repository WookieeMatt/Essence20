import { registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { registerEvent } from "../../types.mjs";
import { resolve } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A (round 10): two Trigger events fired from hand-written code.
 *
 * - Event `beforeRoll` - a roll is about to be made (mechanics/item-hooks.mjs's preRoll, before the dialog; a cancelled
 *   dialog still counted it): the rolled item is the roll item (item:own), roll:dataset: reads its dataset.
 * - Event `groupTestResult` - a Group Test card has every result in (mechanics/rolls/group-tests.mjs), fired on each
 *   participant with `@var.success` (1 / 0), `@var.successes`, `@var.participants`.
 */

registerEvent('beforeRoll');
registerEvent('groupTestResult');

registerPreRoll(async (actor, dataset, item) => {
  // A beforeRoll Trigger reaching the actor (a mark carrying it - Trade School, round 17) counts too.
  const listens = entry => entry.rule.event == 'beforeRoll';
  if (!actor || !(rulesOfType(actor, 'Trigger').some(listens) || linkedEntries(actor, 'Trigger').some(listens))) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'beforeRoll', { roll: { item: item ?? null, rolledSkill: dataset?.skill, dataset: dataset ?? {} } });
});

/** A finished Group Test card: groupTestResult on each participant (by the client that changed the card). */
export async function onGroupTestCard(message) {
  const test = message?.flags?.essence20?.groupTest;
  if (!test?.participants?.length) {
    return;
  }

  const { tally } = await import("../../../mechanics/rolls/group-tests.mjs");
  const outcome = tally(test);
  if (!outcome.done) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  for (const id of test.participants) {
    const actor = resolve(id);
    if (actor) {
      await fireTriggers(actor, 'groupTestResult', { vars: { success: outcome.success ? 1 : 0, successes: outcome.successes, participants: outcome.rows.length } });
    }
  }
}

globalThis.Hooks?.on?.('updateChatMessage', (message, changes, options, userId) => {
  if (userId == globalThis.game?.user?.id && message?.flags?.essence20?.groupTest) {
    onGroupTestCard(message);
  }
});
