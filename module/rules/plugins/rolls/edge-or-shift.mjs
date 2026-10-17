import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `EdgeOrShift {upshift}` - the roll gains an Edge, or `upshift` ↑ instead when it already has an
 * Edge from somewhere else. Decided in dice.mjs#rollSkill before the dialog, against the Edge the roll has by then
 * (the Skill's own, its Essence's, the automatic modifiers and item rules); one rule counts (the biggest). Expert in Your
 * Field: `{upshift: 3, when: ["skill:choiceOf:<the Field Perk>"]}`.
 */

registerRuleType('EdgeOrShift', {
  params: { upshift: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** The ↑ an EdgeOrShift rule would give this roll in place of a second Edge, or null when none applies. */
export function ruleEdgeOrShift(actor, roll = {}) {
  let best = null;
  for (const { rule, item } of actor ? rulesOfType(actor, 'EdgeOrShift') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true) {
      best = Math.max(best ?? 0, Math.max(0, Math.round(resolveValue(rule.upshift, { actor, item }, 0))));
    }
  }

  return best;
}
