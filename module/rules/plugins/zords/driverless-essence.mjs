import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (items2): rule DriverlessEssence {essence} - a vehicle or Zord with no one driving counts that as the Essence
 * Score behind its driver-borrowed Defenses (Willpower / Cleverness - mechanics/combat/combat.mjs#getDefenseValue's
 * usesDrivers branch): Relic Key's "a default Smarts and Social of 3 when ... no crew is currently driving". Several:
 * the highest. None: null (the code's own defaults, then "can't be affected").
 */
registerRuleType('DriverlessEssence', {
  params: { essence: { kind: 'formula', required: true } },
  scopes: ['self'],
  validate: rule => (rule.essence === undefined || rule.essence === '' ? ['essence is required'] : []),
});

export function ruleDriverlessEssence(actor) {
  let best = null;
  for (const { rule, item } of rulesOfType(actor, 'DriverlessEssence')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    const value = Math.round(resolveValue(rule.essence, { actor, item }, 0));
    best = best === null ? value : Math.max(best, value);
  }

  return best;
}
