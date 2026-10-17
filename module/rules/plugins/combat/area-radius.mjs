// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): AreaRadius.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/combat/aoe-targeting.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `AreaRadius {add, items?}` - feet added to the radius of an area the holder places (mechanics/combat/aoe-targeting.mjs#
 * getEffectiveRadiusFeet: the placed shape only - the stored system.radius, which other code reads as "this is an area",
 * is left alone), before any multiplier (Bring It All Down's doubling, Eruptive). `items` (item tags, `item:` = the
 * attack or spell) narrows it: Bigger Booms is {add: 10, items: ["item:data:system.classification.style=explosive"]}.
 */
registerRuleType('AreaRadius', {
  params: { add: { kind: 'formula', required: true }, items: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => (rule.items !== undefined && !Array.isArray(rule.items) ? ['items must be a list of item tags'] : []),
});

/**
 * Feet the actor's AreaRadius rules add to this item's placed radius.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {Number}
 */
export function ruleAreaRadiusBonus(actor, item) {
  if (!actor) {
    return 0;
  }

  let feet = 0;
  for (const { rule, item: ruleItem } of rulesOfType(actor, 'AreaRadius')) {
    const ctx = contextFor({ self: actor, holder: actor, ruleItem, item, isAttack: item?.type == 'weaponEffect' });
    if (evaluate(rule.when, ctx) === true && evaluate(rule.items, ctx) === true) {
      feet += Number(resolveValue(rule.add, { actor, item: ruleItem }, 0)) || 0;
    }
  }

  return feet;
}
