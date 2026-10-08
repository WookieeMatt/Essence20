import { registerCostRuleProvider } from "../mechanics/item-hooks.mjs";
import { resolveValue } from "./formula.mjs";
import { ruleLabel, rulesOfType } from "./index.mjs";
import { contextFor, evaluate } from "./predicate.mjs";
import { ACTION_KEYS } from "./types.mjs";

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

/**
 * Add a cost kind a plug-in passes as `context.kind` to the action economy's spend (reload, morph...): an ActionCost
 * may then name it as its `action`.
 */
export function registerActionKind(name) {
  if (!KINDS.includes(name)) {
    KINDS.push(name);
  }

  if (!ACTION_KEYS.includes(name)) {
    ACTION_KEYS.push(name);
  }
}

/** Whether a cost context is the action this rule names. */
export function actionMatches(rule, ctx = {}) {
  // any: every action that costs something (a Talent's "an action related to <Spirit>" - the player is asked).
  if (rule.action == 'any') {
    return !!ctx;
  }

  if (KINDS.includes(rule.action)) {
    return ctx.kind == rule.action;
  }

  return ctx.key == rule.action;
}

/** to: downgrade - one step cheaper (Standard -> Move, Move -> Free, Free -> none), as mechanics/actions/action-perks.mjs's Talents. */
const DOWNGRADE = { standard: 'move', contingency: 'move', move: 'free', free: 'none' };

/**
 * One ActionCost rule as a cost rule, for the actor paying (its own rule, or one a mark carries onto it).
 * limit.freeIsUnlimited: a Free action made free isn't counted against the limit.
 */
export function costRuleFor(actor, { rule, item, index }) {
  return {
    // limit.key: the counter it uses is that name (actionPerkDailyUses.<key> for a day limit - Sensitive spends the same).
    id: rule.limit?.key ? String(rule.limit.key) : `rule-${item.id}-${index}`,
    label: ruleLabel(rule, item),
    has: () => true,
    matches: ctx => actionMatches(rule, ctx) && evaluate(rule.when, contextFor({
      self: actor, ruleItem: item, item: ctx?.item ?? null, isAttack: ctx?.kind == 'attack' || !!ctx?.attack,
    })) !== false,
    to: type => (rule.to == 'downgrade' ? DOWNGRADE[type] ?? type : rule.to),
    ...(rule.limit?.per ? { limit: {
      window: rule.limit.per, max: Math.max(1, Math.round(resolveValue(rule.limit.max ?? 1, { actor, item }, 1))),
      ...(rule.limit.freeIsUnlimited ? { freeIsUnlimited: true } : {}),
    } } : {}),
    ...(rule.ask ? { ask: rule.ask } : {}),
  };
}

/**
 * The actor's ActionCost rules as cost rules (its own - a `marked` one acts for whoever carries the mark:
 * rules/plugins/resources/action-cost-any.mjs).
 * @param {Actor} actor
 * @returns {Array<Object>}
 */
export function costRulesFor(actor) {
  return rulesOfType(actor, 'ActionCost').filter(({ rule }) => (rule.scope ?? 'self') == 'self').map(entry => costRuleFor(actor, entry));
}

registerCostRuleProvider(costRulesFor);
