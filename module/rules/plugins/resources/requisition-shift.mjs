// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): RequisitionShift.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/resources/requisition.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `RequisitionShift {upshift, items?}` - the holder's Requisition Test for an item matching `items` (item tags, `item:` =
 * the item requisitioned - `item:data:system.totalAvailability=theoretical`) starts with that many ↑ (the roll's own
 * shiftUp, mechanics/resources/requisition.mjs#rollRequisition - not a dialog source). Expert Guidance: ↑2 for
 * Theoretical equipment. `when` sees the actor.
 */
registerRuleType('RequisitionShift', {
  params: { upshift: { kind: 'formula', required: true }, items: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => (rule.items !== undefined && !Array.isArray(rule.items) ? ['items must be a list of item tags'] : []),
});

/**
 * The ↑ the actor's RequisitionShift rules give a Requisition Test for this item.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {Number}
 */
export function ruleRequisitionShift(actor, item) {
  if (!actor) {
    return 0;
  }

  let shift = 0;
  for (const { rule, item: ruleItem } of rulesOfType(actor, 'RequisitionShift')) {
    const ctx = contextFor({ self: actor, holder: actor, ruleItem, item });
    if (evaluate(rule.when, ctx) === true && evaluate(rule.items, ctx) === true) {
      shift += Math.max(0, Math.round(Number(resolveValue(rule.upshift, { actor, item: ruleItem }, 0)) || 0));
    }
  }

  return shift;
}
