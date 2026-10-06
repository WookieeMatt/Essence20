import { registerCostRuleProvider } from "../mechanics/item-hooks.mjs";
import { resolveValue } from "./formula.mjs";
import { ruleLabel, rulesOfType } from "./index.mjs";
import { contextFor, evaluate } from "./predicate.mjs";

/**
 * ActionCost rules (docs/RULES_ENGINE_PLAN.md §4.9) - "you can Sprint as a Free action once per
 * turn", "drawing a weapon costs no action".
 *
 * The action economy already offers cheaper ways to pay (mechanics/actions/action-perks.mjs#getCostOptions,
 * its COST_RULES table). Each ActionCost rule on an actor's items becomes one more entry in that
 * table, in the same shape, through registerCostRuleProvider - so it is offered, limited and logged
 * exactly like the hand-written ones.
 *
 *   action  a named action key (sprint, hide, lendAssistance...) or a kind: attack, item, conversion,
 *           shieldToggle
 *   to      what it costs instead: none, free, twoFree, move, standard
 *   limit   {per: turn | scene | encounter, max}
 *   ask     a question the player answers first ("Is a teammate ahead of you?") - unset applies itself
 */

const KINDS = ['attack', 'item', 'conversion', 'shieldToggle'];

/** Whether a cost context is the action this rule names. */
export function actionMatches(rule, ctx = {}) {
  if (KINDS.includes(rule.action)) {
    return ctx.kind == rule.action;
  }

  return ctx.key == rule.action;
}

/**
 * The actor's ActionCost rules as cost rules.
 * @param {Actor} actor
 * @returns {Array<Object>}
 */
export function costRulesFor(actor) {
  return rulesOfType(actor, 'ActionCost').map(({ rule, item, index }) => ({
    // limit.key: the counter it uses is that name (actionPerkDailyUses.<key> for a day limit - Sensitive spends the same).
    id: rule.limit?.key ? String(rule.limit.key) : `rule-${item.id}-${index}`,
    label: ruleLabel(rule, item),
    has: () => true,
    matches: ctx => actionMatches(rule, ctx) && evaluate(rule.when, contextFor({
      self: actor, ruleItem: item, item: ctx?.item ?? null, isAttack: ctx?.kind == 'attack' || !!ctx?.attack,
    })) !== false,
    to: () => rule.to,
    ...(rule.limit?.per ? { limit: { window: rule.limit.per, max: Math.max(1, Math.round(resolveValue(rule.limit.max ?? 1, { actor, item }, 1))) } } : {}),
    ...(rule.ask ? { ask: rule.ask } : {}),
  }));
}

registerCostRuleProvider(costRulesFor);
