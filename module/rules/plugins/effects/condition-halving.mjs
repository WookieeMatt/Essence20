import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerConditionDuration } from "../../steps.mjs";

/**
 * Round 18 (convA): rule type `ConditionHalving {conditions: [status ids]}` - a Condition from that list put on the
 * holder by an `applyCondition` step lasts half as long ("if they are successful, the effect only lasts half as long" -
 * Gallantry):
 * - `rounds: N` becomes half of N, rounded down (never below 1) - user ruling 2026-10-07;
 * - "until the end of ... next turn" (`until: endOfNextTurn`, whoever's turn it counts) ends as that turn starts instead
 *   (`nextTurn`); the `...OrScene` spelling likewise (user ruling 2026-10-07). `when` is asked with self = the holder and target = the
 * actor whose step applies it. Read through rules/steps.mjs#registerConditionDuration, so only Conditions the rules apply
 * are halved.
 */

registerRuleType('ConditionHalving', {
  params: { conditions: { kind: 'strings', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.conditions) && rule.conditions.length ? [] : ['conditions needs at least one status id']),
});

const SHORTER = { endOfNextTurn: 'nextTurn', endOfNextTurnOrScene: 'nextTurnOrScene' };

/** Whether the recipient holds a ConditionHalving rule for this Condition that holds now. */
export function halvesCondition(recipient, condition, applier = null) {
  return rulesOfType(recipient, 'ConditionHalving').some(({ rule, item }) => !rule.disabled
    && (rule.conditions ?? []).includes(condition)
    && evaluate(rule.when, contextFor({ self: recipient, holder: recipient, ruleItem: item, other: applier })) === true);
}

/** The halved duration ({until, rounds}), or null when nothing changes. */
export function halvedDuration(recipient, condition, { until, rounds } = {}, applier = null) {
  if (!recipient || !halvesCondition(recipient, condition, applier)) {
    return null;
  }

  const out = {};
  if (Number(rounds) > 0) {
    out.rounds = Math.max(1, Math.floor(Number(rounds) / 2));
  }

  if (SHORTER[until]) {
    out.until = SHORTER[until];
  }

  return out;
}

registerConditionDuration((recipient, condition, spec, ctx) => halvedDuration(recipient, condition, spec, ctx?.actor ?? null));
