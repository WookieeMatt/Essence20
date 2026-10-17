// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): SenseMultiplier.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/characters/vision-grant.mjs loads it
// directly.
import { isItemActive, rulesOf } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SenseMultiplier {multiply}` - when SOMETHING ELSE gives the holder darkvision (another item's visionGrant, an ally's
 * team-wide grant, a Sense rule), the best range on offer is multiplied (Used to the Dark: x2). The rule's own item's
 * visionGrant doesn't count as that something else (alone, it is just its own range). Read by
 * mechanics/characters/vision-grant.mjs#getBestVisionGrant. `when` sees the actor.
 */
registerRuleType('SenseMultiplier', {
  params: { multiply: { kind: 'number', required: true } },
  scopes: ['self'],
  validate: rule => (Number(rule.multiply) > 0 ? [] : ['multiply must be a positive number']),
});

/**
 * The multiplier this item's SenseMultiplier rules give its holder now (1 for none, 0 when the item has none at all).
 * @param {Item} item
 * @param {Actor} actor
 * @returns {Number}   0: the item carries no SenseMultiplier rule.
 */
export function itemSenseMultiplier(item, actor) {
  const rules = rulesOf(item).filter(rule => rule?.type == 'SenseMultiplier' && !rule.disabled);
  if (!rules.length) {
    return 0;
  }

  if (!isItemActive(item)) {
    return 1;
  }

  return rules.reduce((best, rule) => (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true
    ? Math.max(best, Number(rule.multiply) || 1) : best), 1);
}
