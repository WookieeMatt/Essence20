import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `CritDowngrade {prompt, steps?}` - when the dice show a Critical Success (a natural one, or a
 * row at double the Difficulty), the roller is asked `prompt` (a lang key or text) before anything is built from it:
 * yes, and the roll counts as a plain success (dice.mjs#_rollSkillHelper's consistentDowngrade - every row's Degrees of
 * Success capped at 1); the rule's `steps` then run as the roller once the card is done. The first rule that holds is
 * asked. Consistent (Silver Medal Syndrome): `{prompt: E20.ConsistentPrompt, steps: [{do: bank, upshift: 1}]}`.
 */

registerRuleType('CritDowngrade', {
  params: { prompt: { kind: 'string', required: true }, steps: { kind: 'object' } },
  scopes: ['self'],
});

const localize = key => {
  const text = globalThis.game?.i18n?.localize?.(key);
  return text && text != key ? text : key;
};

/**
 * Ask the actor's CritDowngrade rule, if one holds. The picked rule when the player said yes, else null.
 * @param {Actor} actor
 * @param {Object} [roll]   {rolledSkill, item...}
 */
export async function askCritDowngrade(actor, roll = {}) {
  const found = (actor ? rulesOfType(actor, 'CritDowngrade') : [])
    .find(({ rule, item }) => evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true);
  if (!found) {
    return null;
  }

  const yes = await globalThis.foundry?.applications?.api?.DialogV2?.confirm?.({
    window: { title: found.item?.name ?? '' },
    content: `<p>${localize(found.rule.prompt)}</p>`,
    rejectClose: false,
  });
  return yes ? found : null;
}

/** Run a picked CritDowngrade rule's steps as the roller. */
export async function runCritDowngrade(actor, picked) {
  if (!picked || !Array.isArray(picked.rule.steps) || !picked.rule.steps.length) {
    return;
  }

  const { runSteps, stepContext } = await import("../../steps.mjs");
  await runSteps(picked.rule.steps, stepContext({ actor, item: picked.item, rule: picked.rule }));
}
