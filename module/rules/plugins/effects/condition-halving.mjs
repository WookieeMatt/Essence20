import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerConditionDuration } from "../../steps.mjs";

/**
 * Round 18 (convA): rule type `ConditionHalving {conditions: [status ids]}` - a Condition from that list put on the
 * holder by an `applyCondition` step lasts half as long ("if they are successful, the effect only lasts half as long" -
 * Gallantry):
 * - `rounds: N` becomes half of N, rounded up (never below 1);
 * - "until the end of your next turn" counted on the holder's own turns (`until: endOfNextTurn`, `untilOf: recipient`)
 *   ends as that turn starts instead (`nextTurn`); the `...OrScene` spelling likewise.
 * A duration counted on someone else's turns is left alone. `when` is asked with self = the holder and target = the
 * actor whose step applies it. Read through rules/steps.mjs#registerConditionDuration, so only Conditions the rules apply
 * are halved.
 */

registerRuleType('ConditionHalving', {
  params: { conditions: { kind: 'strings', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.conditions) && rule.conditions.length ? [] : ['conditions needs at least one status id']),
});

const SHORTER = { endOfNextTurn: 'nextTurn', endOfNextTurnOrScene: 'nextTurnOrScene' };

const same = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

/** Whether the recipient holds a ConditionHalving rule for this Condition that holds now. */
export function halvesCondition(recipient, condition, applier = null) {
  return rulesOfType(recipient, 'ConditionHalving').some(({ rule, item }) => !rule.disabled
    && (rule.conditions ?? []).includes(condition)
    && evaluate(rule.when, contextFor({ self: recipient, holder: recipient, ruleItem: item, other: applier })) === true);
}

/** The halved duration ({until, rounds}), or null when nothing changes. */
export function halvedDuration(recipient, condition, { until, rounds, untilActor } = {}, applier = null) {
  if (!recipient || !halvesCondition(recipient, condition, applier)) {
    return null;
  }

  const out = {};
  if (Number(rounds) > 0) {
    out.rounds = Math.max(1, Math.ceil(Number(rounds) / 2));
  }

  if (SHORTER[until] && same(untilActor, recipient)) {
    out.until = SHORTER[until];
  }

  return out;
}

registerConditionDuration((recipient, condition, spec, ctx) => halvedDuration(recipient, condition, spec, ctx?.actor ?? null));
