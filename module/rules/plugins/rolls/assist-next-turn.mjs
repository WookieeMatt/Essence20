import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Assist `effect: "nextTurnGrant"` (side give - round 15, systems, docs/rules-batches/slSystems15.md): one more choice in the
 * helper's Lend Assistance dialog - instead of the usual bonus, the ally gets the rule's `free` / `move` / `standard`
 * actions on its next turn (mechanics/actions/action-economy.mjs#setNextTurn). `label` (an `E20.` key or text) names the
 * choice. Read by mechanics/actions/lend-assistance.mjs. Import-light: that file loads this one directly.
 */

const ASSIST = RULE_TYPES.Assist;
if (ASSIST) {
  if (!ASSIST.params.effect.options.includes('nextTurnGrant')) {
    ASSIST.params.effect.options.push('nextTurnGrant');
  }

  for (const kind of ['free', 'move', 'standard']) {
    ASSIST.params[kind] ??= { kind: 'formula' };
  }
}

const localize = text => (globalThis.game?.i18n?.has?.(text) ? globalThis.game.i18n.localize(text) : globalThis.game?.i18n?.localize?.(text) ?? text);

/**
 * The next-turn grants this helper's Assist rules offer: [{mode, label, grant}].
 * @param {Actor} actor   The helper.
 * @returns {Array<Object>}
 */
export function ruleAssistGrantModes(actor) {
  return rulesOfType(actor, 'Assist').filter(({ rule, item }) => rule.effect == 'nextTurnGrant' && (rule.side ?? 'give') == 'give'
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) !== false)
    .map(({ rule, item, index }) => ({
      mode: `rule-${item.id}-${index}`,
      label: rule.label ? localize(String(rule.label)) : item.name,
      grant: Object.fromEntries(['free', 'move', 'standard'].map(kind => [kind, Math.max(0, Math.round(Number(rule[kind]) || 0))]).filter(([, n]) => n > 0)),
    }))
    .filter(mode => Object.keys(mode.grant).length);
}
