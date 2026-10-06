// Round 15 (items1): rule type HealBonus - I've Got You, Up And At 'Em.
import { registerRuleType } from "../../types.mjs";
import { rulesOfType, ruleLabel } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { runSteps, stepContext, stepErrors } from "../../steps.mjs";

/**
 * `HealBonus {amount, steps?}` - when the holder restores Health the way the Heal action does
 * (mechanics/actions/heal-action.mjs#restoreHealth: the Heal action, the `healAction` step), the healed creature gets
 * `amount` more while `when` holds (target: = the one healed, asked before the heal - `target:status:defeated`). Its
 * `steps` run after the heal, as the holder, the healed one as the target (Up And At 'Em's banked Edge).
 */
registerRuleType('HealBonus', {
  params: { amount: { kind: 'formula' }, steps: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => [
    ...(rule.amount === undefined && rule.steps === undefined ? ['needs amount or steps'] : []),
    ...(rule.steps !== undefined ? stepErrors(rule.steps) : []),
  ],
});

/** The healer's HealBonus rules that hold for healing `target` (asked before it is healed). */
export function healBonuses(healer, target) {
  return rulesOfType(healer, 'HealBonus').filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: healer, ruleItem: item, other: target })) === true)
    .map(({ rule, item }) => ({ rule, item, amount: Math.round(resolveValue(rule.amount ?? 0, { actor: healer, item, other: target }, 0)) }));
}

/** Run the steps of the bonuses that applied to a heal. */
export async function runHealBonusSteps(healer, target, bonuses = []) {
  for (const { rule, item } of bonuses) {
    if (!Array.isArray(rule.steps) || !rule.steps.length) {
      continue;
    }

    const ctx = stepContext({ actor: healer, item, rule, targets: [target] });
    await runSteps(rule.steps, ctx);
    if (ctx.chat.length && globalThis.ChatMessage?.create) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor: healer }), content: [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat].join('<br>') });
    }
  }
}
