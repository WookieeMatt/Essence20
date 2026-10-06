import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Group H: `IgnoreDrawback {drawbacks: [...]}` - the holder ignores those drawbacks while `when` holds.
 * `limitedArticulation`: an Alt Mode's Limited Articulation no longer refuses its Skill Tests (dice.mjs asks
 * ruleIgnoresDrawback). Import-light: dice.mjs loads this file directly.
 */

export const DRAWBACKS = ['limitedArticulation'];

registerRuleType('IgnoreDrawback', {
  params: { drawbacks: { kind: 'strings', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.drawbacks) && rule.drawbacks.length && rule.drawbacks.every(name => DRAWBACKS.includes(name))
    ? [] : [`drawbacks must list some of ${DRAWBACKS.join(', ')}`]),
});

/** Whether one of the actor's IgnoreDrawback rules lifts that drawback now. */
export function ruleIgnoresDrawback(actor, drawback) {
  if (!actor) {
    return false;
  }

  return rulesOfType(actor, 'IgnoreDrawback').some(({ rule, item }) => (rule.drawbacks ?? []).includes(drawback)
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
}
