import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `SizeMatrix {attackerSteps}` - for the Size Class Combat Adjustment shift only (dice.mjs's
 * _getSizeShift), the attacker counts as that many places further up the size ladder (E20.actorSizes order, never past
 * its top). The actor's real size is untouched (a `Size` rule changes system.size itself). When Push Comes To Shove: one
 * step on a grapple attack. `when` sees the roll; the other party is its target.
 */

registerRuleType('SizeMatrix', {
  params: { attackerSteps: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** How many ladder places the actor's SizeMatrix rules move it up for this attack's size shift. */
export function ruleSizeMatrixSteps(actor, target, roll = {}) {
  let steps = 0;
  for (const { rule, item } of actor ? rulesOfType(actor, 'SizeMatrix') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item, other: target })) === true) {
      steps += Math.round(resolveValue(rule.attackerSteps, { actor, item, other: target }, 0));
    }
  }

  return steps;
}
