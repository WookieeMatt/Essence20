import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `AllyRangeMultiplier {multiply}` (round 15, uses) - an ally's effect that reaches allies within N feet reaches
 * the holder from N x `multiply` feet: mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens asks it of each ally token it
 * measures (Ally Awareness: 5). The biggest counts; `when` sees the holder. Light on imports - nearby-allies.mjs loads it.
 */

registerRuleType('AllyRangeMultiplier', {
  params: { multiply: { kind: 'number', required: true } },
  scopes: ['self'],
});

/** The range multiplier allies' "within N feet" effects reach this actor with (1 with none). */
export function ruleAllyRangeMultiplier(actor) {
  return Math.max(1, ...rulesOfType(actor, 'AllyRangeMultiplier')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true)
    .map(({ rule }) => Number(rule.multiply) || 1));
}
