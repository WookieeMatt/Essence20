import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `BraceUntilMoved {}` (round 15, systems - docs/rules-batches/slSystems15.md): the holder's Brace action
 * (mechanics/actions/named-actions.mjs#brace) lasts until they move, not just the turn - Integrated Bipod. `when` sees the
 * actor. A rule with `always: true` counts while its item is switched off too (the bipod on a stowed weapon). Import-light:
 * named-actions.mjs loads it directly.
 */
registerRuleType('BraceUntilMoved', { params: {}, scopes: ['self'] });

/** Whether this actor's Brace lasts until it moves. */
export function ruleBraceUntilMoved(actor) {
  return rulesOfType(actor, 'BraceUntilMoved').some(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) !== false);
}
