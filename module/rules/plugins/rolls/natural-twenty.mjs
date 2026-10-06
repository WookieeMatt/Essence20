import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (items2): rule type `NaturalTwenty {}` (+ `when`) - when the kept d20 shows a natural 20, the roll succeeds
 * against that DIF, and one that would succeed anyway is a Critical Success (Degrees of Success at least 2). Read by
 * dice.mjs's per-target multiplier loop (ruleNaturalTwentyMultiplier), after Unconscious / No Factor and before
 * Consistent, where the hand-written Better than the Best sat. `when` sees self = the roller, target = that row's target,
 * the rolled Skill / item. Kept import-light: dice.mjs imports it at the top.
 */
registerRuleType('NaturalTwenty', { params: {}, scopes: ['self'] });

/** The kept d20's values (an Edge / Snag keeps one - Foundry's `values` are the active results only). */
function keptD20(roll) {
  const d20 = (roll?.dice ?? []).find(pool => pool.faces === 20);
  return d20?.values ?? (d20?.results ?? []).filter(r => r.active !== false).map(r => r.result);
}

/**
 * A row's Degrees of Success after the actor's NaturalTwenty rules.
 * @param {Actor} actor   The roller.
 * @param {Roll} roll
 * @param {Number} multiplier   This row's Degrees of Success so far (0 miss, 1 success, 2+ crit).
 * @param {Object} [context]  {targetUuid (the row's target), item, rolledSkill, rolledEssence}
 * @returns {Number}
 */
export function ruleNaturalTwentyMultiplier(actor, roll, multiplier, { targetUuid = null, item = null, rolledSkill, rolledEssence } = {}) {
  const rules = rulesOfType(actor, 'NaturalTwenty');
  if (!rules.length || !keptD20(roll)?.includes?.(20)) {
    return multiplier;
  }

  const target = targetUuid ? globalThis.fromUuidSync?.(targetUuid, { strict: false }) ?? null : null;
  const holds = rules.some(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ self: actor, other: target, ruleItem, item, rolledSkill, rolledEssence })) === true);
  if (!holds) {
    return multiplier;
  }

  return multiplier > 0 ? Math.max(multiplier, 2) : 1;
}
