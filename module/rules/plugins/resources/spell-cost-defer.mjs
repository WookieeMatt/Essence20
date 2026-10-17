// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): SpellCostDefer.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: documents/item.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SpellCostDefer {}` - a spell's Casting Cost lands on Spellcasting after its Skill Test, not before (documents/item.mjs's
 * spell cast: the cast rolls with only the downshift already lingering; the cost is added to
 * system.skills.spellcasting.shiftDown afterwards as usual). Power Conservationist, Power Mastery. `when` sees the
 * caster and the spell (`item:`).
 */
registerRuleType('SpellCostDefer', { params: {}, scopes: ['self'] });

/**
 * Whether the caster's SpellCostDefer rules put this spell's cost after its Skill Test.
 * @param {Actor} actor
 * @param {Item} spell
 * @returns {Boolean}
 */
export function ruleDefersSpellCost(actor, spell) {
  if (!actor) {
    return false;
  }

  return rulesOfType(actor, 'SpellCostDefer').some(({ rule, item }) =>
    evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, item: spell ?? null })) === true);
}
