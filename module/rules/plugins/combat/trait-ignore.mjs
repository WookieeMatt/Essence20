// Round 15 (items1): rule type TraitIgnore - Ordnance Expert.
import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * `TraitIgnore {traits: [mounted], items?: [item tags]}` - the holder ignores those weapon traits on its weapons (all of
 * them, or those `items` matches, asked of the weapon). `mounted`: a Mounted weapon counts as set up
 * (items/attacks/mounted-weapons.mjs#isMountedWeaponSetUp). `when` sees the holder.
 */
export const IGNORABLE_TRAITS = ['mounted'];

registerRuleType('TraitIgnore', {
  params: { traits: { kind: 'strings', required: true }, items: { kind: 'strings' } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.traits) && rule.traits.length && rule.traits.every(trait => IGNORABLE_TRAITS.includes(trait))
    ? [] : [`traits must be a list of ${IGNORABLE_TRAITS.join(', ')}`]),
});

/**
 * Whether the weapon's holder ignores `trait` on it.
 * @param {?Actor} actor
 * @param {?Item} weapon
 * @param {String} trait
 */
export function ruleIgnoresTrait(actor, weapon, trait) {
  if (!actor) {
    return false;
  }

  return rulesOfType(actor, 'TraitIgnore').some(({ rule, item }) => (rule.traits ?? []).includes(trait)
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true
    && (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.items, contextFor({ self: actor, ruleItem: item, item: weapon })) === true));
}
