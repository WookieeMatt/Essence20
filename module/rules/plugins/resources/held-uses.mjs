import { registerRuleType } from "../../types.mjs";
import { rulesOf } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";

/**
 * Round 18 (convA): rule type `HeldUse {count?}` on a Power with daily uses - while `when` holds, a Rest gives back all
 * but `count` (a formula, default 1) of its spent uses: a use tied up in something still running can't be regained
 * until it ends ("until you recall them, you cannot regain the spent power use" - Dominate, `when:
 * ["self:marking:dominated"]`). Never more than the uses actually spent. `when` is asked of the Power's actor (self).
 * Read by mechanics/resources/nanomite-uses.mjs#resetDailyPowerUses.
 */

registerRuleType('HeldUse', {
  params: { count: { kind: 'formula' } },
  scopes: ['self'],
});

/**
 * How many of this Power's spent daily uses a Rest leaves spent (0 with no HeldUse rule holding).
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Number}
 */
export function ruleHeldUses(actor, power) {
  const spent = Math.max(0, Number(power?.system?.usesSpent) || 0);
  let held = 0;
  for (const rule of rulesOf(power)) {
    if (rule?.type != 'HeldUse' || rule.disabled) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: power })) !== true) {
      continue;
    }

    held = Math.max(held, Math.round(resolveValue(rule.count ?? 1, { actor, item: power }, 1)));
  }

  return Math.min(spent, Math.max(0, held));
}
