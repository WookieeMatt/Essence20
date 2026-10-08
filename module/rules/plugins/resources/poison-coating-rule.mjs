// Round 15 (items1): rule type PoisonCoating - Poisonous, Intoxicate, Poison Tipped.
import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * `PoisonCoating {cost?: move | free, keepVialOnFumble?}` - coating a weapon with a contact poison
 * (items/gear/poison-coating.mjs): `cost` - the action it takes instead of a Standard one (the cheapest rule wins: free
 * before move); `keepVialOnFumble` - a Fumbled coating roll doesn't use the vial up. `when` sees the actor.
 */
registerRuleType('PoisonCoating', {
  params: { cost: { kind: 'enum', options: ['move', 'free'] }, keepVialOnFumble: { kind: 'bool' } },
  scopes: ['self'],
  validate: rule => (rule.cost === undefined && !rule.keepVialOnFumble ? ['needs cost or keepVialOnFumble'] : []),
});

function live(actor) {
  return rulesOfType(actor, 'PoisonCoating').filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
}

/** The action coating takes: 'free', 'move', or null (the standard Standard action). */
export function ruleCoatingCost(actor) {
  const costs = live(actor).map(({ rule }) => rule.cost).filter(Boolean);
  return costs.includes('free') ? 'free' : costs.includes('move') ? 'move' : null;
}

/** Whether a Fumbled coating roll keeps the vial. */
export function ruleKeepsVialOnFumble(actor) {
  return live(actor).some(({ rule }) => !!rule.keepVialOnFumble);
}
