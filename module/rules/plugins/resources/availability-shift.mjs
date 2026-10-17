// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): AvailabilityShift.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: documents/item.mjs loads it directly.
import { isItemActive, rulesOf } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `AvailabilityShift {steps, items?}` - the holder's equipment counts that many Availability tiers more available
 * (negative) or less (positive): documents/item.mjs#_prepareTotalAvailability steps each owned item's totalAvailability
 * by the sum, after its upgrades are folded in (Fieldtest: -1). `items` (item tags) narrows which items; `when` sees the
 * actor. Read straight off the actor's items as each item prepares (the rules index is built later in the actor's own
 * pass), so a rule just added counts at once.
 */
registerRuleType('AvailabilityShift', {
  params: { steps: { kind: 'number', required: true }, items: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => (rule.items !== undefined && !Array.isArray(rule.items) ? ['items must be a list of item tags'] : []),
});

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

/**
 * How many tiers this item's Availability moves for its owner's AvailabilityShift rules.
 * @param {Item} item
 * @returns {Number}
 */
export function ruleAvailabilitySteps(item) {
  const actor = item?.actor ?? item?.parent;
  if (!actor) {
    return 0;
  }

  let steps = 0;
  // A second copy of the same book item counts once (as rules/index.mjs#collectRules does), unless the rule stacks.
  const seen = new Set();
  for (const holder of listOf(actor.items)) {
    const rules = rulesOf(holder).filter(rule => rule?.type == 'AvailabilityShift' && !rule.disabled);
    if (!rules.length || !isItemActive(holder)) {
      continue;
    }

    const source = holder.flags?.core?.sourceId ?? holder._stats?.compendiumSource ?? holder.flags?.essence20?.rulesSource ?? holder.id;
    for (const [index, rule] of rules.entries()) {
      const key = `${source}#${index}`;
      if (rule.stacks !== true && seen.has(key)) {
        continue;
      }

      seen.add(key);
      const ctx = contextFor({ self: actor, holder: actor, ruleItem: holder, item });
      if (evaluate(rule.when, ctx) === true && evaluate(rule.items, ctx) === true) {
        steps += Math.round(Number(rule.steps) || 0);
      }
    }
  }

  return steps;
}
