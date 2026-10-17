// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): JoinDie.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/vehicles/combiner-timer.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `JoinDie {steps}` - a Combiner Zord's join-time die is that many types smaller (d6, d4, d2, then a flat 1 -
 * mechanics/vehicles/combiner-timer.mjs#getCombineDie), before the JoinTime rules adjust the rolled time. Give it
 * `stacks: true` when every copy counts (Fast Modulation: each pick, one step). `when` sees the Zord.
 */
registerRuleType('JoinDie', {
  params: { steps: { kind: 'number', required: true } },
  scopes: ['self'],
  validate: rule => (Number.isInteger(rule.steps) && rule.steps > 0 ? [] : ['steps must be a whole number above 0']),
});

/**
 * How many die types the Zord's JoinDie rules take off its join-time die.
 * @param {Actor} zord
 * @returns {Number}
 */
export function ruleJoinDieSteps(zord) {
  if (!zord) {
    return 0;
  }

  return rulesOfType(zord, 'JoinDie').reduce((total, { rule, item }) => total
    + (evaluate(rule.when, contextFor({ self: zord, holder: zord, ruleItem: item })) === true ? Number(rule.steps) || 0 : 0), 0);
}
