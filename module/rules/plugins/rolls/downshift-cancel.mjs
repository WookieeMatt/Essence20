import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `DownshiftCancel {amount?, stack?, limit?}` - takes `amount` (default 1) off the roll's stacked
 * ↓ BEFORE the Roll Options Dialog opens (dice.mjs#rollSkill, where every automatic and banked ↓ has been added up -
 * "ignore the first ↓1"), so the dialog shows the roll without it. (RollModifier `ignoreDownshift` acts after the
 * dialog, on whatever ↓ the dialog added too.) Only when there is a ↓ to cancel; rules sharing a `stack` group count once
 * (two copies of Expertise for one Skill cancel 1); a `limit` is used up only when it cancelled something (Low Tech
 * Priorities: once per turn across both copies - `limit: {per: turn, key}`). Rules without a limit go first. `when` sees
 * the roll (`skill:{item.choice}`).
 */

registerRuleType('DownshiftCancel', {
  params: { amount: { kind: 'formula' }, stack: { kind: 'string' }, limit: { kind: 'object' } },
  scopes: ['self'],
});

/**
 * The stacked pre-dialog ↓ after the actor's DownshiftCancel rules.
 * @param {Actor} actor
 * @param {Number} shiftDown
 * @param {Object} roll   {item, rolledSkill, rolledEssence, dataset}
 * @returns {Promise<Number>}
 */
export async function ruleDownshiftCancel(actor, shiftDown, roll = {}) {
  let value = Number(shiftDown) || 0;
  if (!actor || value <= 0) {
    return value;
  }

  const groups = new Set();
  const entries = rulesOfType(actor, 'DownshiftCancel').sort((a, b) => (a.rule.limit?.per ? 1 : 0) - (b.rule.limit?.per ? 1 : 0));
  for (const { rule, item, index } of entries) {
    if (value <= 0) {
      break;
    }

    if ((rule.stack && groups.has(rule.stack)) || (rule.limit?.per && usesLeft(actor, rule, item, index) <= 0)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) !== true) {
      continue;
    }

    const amount = Math.max(0, Math.round(resolveValue(rule.amount ?? 1, { actor, item }, 1)));
    if (!amount) {
      continue;
    }

    value = Math.max(0, value - amount);
    if (rule.stack) {
      groups.add(rule.stack);
    }

    if (rule.limit?.per) {
      await recordUse(actor, rule, item, index);
    }
  }

  return value;
}
