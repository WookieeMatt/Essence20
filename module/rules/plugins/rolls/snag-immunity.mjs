// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs. Import-light: dice.mjs imports ruleSnagImmune from here.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `SnagImmunity {}` + `when` - the roll can't suffer a Snag: decided after the Roll Options Dialog and after
 * every Snag the system adds then (Ranger Prime's reciprocal Defense Snags...), at the point dice.mjs cleared Time
 * Traveler's Snag - later than RollModifier `immune: ["snag"]`. `when` sees the roll: `skill:`, `essence:`, `item:`,
 * `roll:dataset:`, `self:` (the roller).
 */
registerRuleType('SnagImmunity', { params: {}, scopes: ['self'] });

/** Whether a SnagImmunity rule of the roller holds for this roll ({item, rolledSkill, rolledEssence, dataset, isAttack}). */
export function ruleSnagImmune(actor, roll = {}) {
  return rulesOfType(actor, 'SnagImmunity').some(({ rule, item }) => evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true);
}
