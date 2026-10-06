import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * RequisitionDif {amount, items?, min?} (round 12, group I) - the DIF of the holder's Requisition Tests changes by
 * `amount` (a formula; -5 lowers it) for items matching `items` (item tags, asked of the item being requisitioned;
 * `item:availability` reads the tier the DIF comes from), never below `min` (default 0). Read by
 * helpers/requisition.mjs#requisitionDif after the Availability DIF is looked up; several rules apply one after
 * another, each floored. `when` sees the actor.
 */

registerRuleType('RequisitionDif', {
  params: {
    amount: { kind: 'formula', required: true },
    items: { kind: 'object' },
    min: { kind: 'formula' },
  },
  scopes: ['self'],
});

/**
 * The DIF once the actor's RequisitionDif rules have changed it.
 * @param {Actor} actor
 * @param {Item} item              The weapon / armor being requisitioned.
 * @param {String} availability    The tier the DIF was read from (after the Qualified-upgrade listeners).
 * @param {Number} dif
 * @returns {Number}
 */
export function ruleRequisitionDif(actor, item, availability, dif) {
  let out = Number(dif) || 0;
  for (const { rule, item: ruleItem } of actor ? rulesOfType(actor, 'RequisitionDif', 'self') : []) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem })) !== true) {
      continue;
    }

    if (Array.isArray(rule.items) && rule.items.length
      && evaluate(rule.items, contextFor({ self: actor, item, ruleItem, effectiveAvailability: availability })) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor, item: ruleItem }, 0));
    const min = rule.min === undefined ? 0 : Math.round(resolveValue(rule.min, { actor, item: ruleItem }, 0));
    out = Math.max(min, out + amount);
  }

  return out;
}
