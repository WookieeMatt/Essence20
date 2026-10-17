import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerEvent, registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `EnergonSpendBonus {upshift, limit?}` - when the Roll Options Dialog's own "spend 1 Energon for
 * ↑1" is used on a roll, that spend gives `upshift` more (dice.mjs's spendEnergon branch). The limit is used up only
 * when it applies. Imaginative Engineering: `{upshift: 1, limit: {per: round}}` (the first such spend each round is ↑2).
 */

registerRuleType('EnergonSpendBonus', {
  params: { upshift: { kind: 'formula', required: true }, limit: { kind: 'object' } },
  scopes: ['self'],
});

/** The extra ↑ the actor's EnergonSpendBonus rules give this Energon spend (their limits are used up). */
export async function ruleEnergonSpendBonus(actor, roll = {}) {
  let extra = 0;
  for (const { rule, item, index } of actor ? rulesOfType(actor, 'EnergonSpendBonus') : []) {
    if (rule.limit?.per && usesLeft(actor, rule, item, index) <= 0) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) !== true) {
      continue;
    }

    extra += Math.max(0, Math.round(resolveValue(rule.upshift, { actor, item }, 0)));
    if (rule.limit?.per) {
      await recordUse(actor, rule, item, index);
    }
  }

  return extra;
}

/**
 * Trigger event `rollEnergonSpent` - the Roll Options Dialog's "spend 1 Energon for ↑1" was paid from the actor's own
 * pool (dice.mjs's spendEnergon branch, after the pool is written; not a Better As One donor's). @var.before is the
 * pool before the spend. Energon Efficiency: `when: [var:before=1]` (the last point), a d6 table giving 1 back on 5+.
 */
registerEvent('rollEnergonSpent');

/** Fire rollEnergonSpent for this roll's Energon spend. */
export async function fireRollEnergonSpent(actor, before, roll = {}) {
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'rollEnergonSpent', { roll, vars: { before: Number(before) || 0 } });
}
