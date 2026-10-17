import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Group H: `IgnoreDrawback {drawbacks: [...]}` - the holder ignores those drawbacks while `when` holds.
 * `limitedArticulation`: an Alt Mode's Limited Articulation no longer refuses its Skill Tests (dice.mjs asks
 * ruleIgnoresDrawback). Import-light: dice.mjs loads this file directly.
 *
 * Round 15 (rest-other): `temperamentalFumble` - a Temperamental weapon's Fumble is only a failure (dice.mjs asks
 * useIgnoredDrawback, which also spends the rule's `limit` - Field Test Expert: once per encounter - and returns the rule,
 * whose `message` (an E20. key with {name}) dice.mjs posts).
 */

export const DRAWBACKS = ['limitedArticulation', 'temperamentalFumble'];

registerRuleType('IgnoreDrawback', {
  params: { drawbacks: { kind: 'strings', required: true }, limit: { kind: 'object' }, message: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.drawbacks) && rule.drawbacks.length && rule.drawbacks.every(name => DRAWBACKS.includes(name))
    ? [] : [`drawbacks must list some of ${DRAWBACKS.join(', ')}`]),
});

/** Whether one of the actor's IgnoreDrawback rules lifts that drawback now. */
export function ruleIgnoresDrawback(actor, drawback) {
  if (!actor) {
    return false;
  }

  return rulesOfType(actor, 'IgnoreDrawback').some(({ rule, item }) => (rule.drawbacks ?? []).includes(drawback)
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
}

/**
 * The first of the actor's IgnoreDrawback rules that lifts that drawback now with a use left under its `limit` - used up,
 * and returned ({rule, item, index}); null when none.
 * @param {Actor} actor
 * @param {String} drawback
 * @returns {Promise<?Object>}
 */
export async function useIgnoredDrawback(actor, drawback) {
  if (!actor) {
    return null;
  }

  const entry = rulesOfType(actor, 'IgnoreDrawback').find(({ rule, item, index }) => (rule.drawbacks ?? []).includes(drawback)
    && usesLeft(actor, rule, item, index) > 0
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
  if (entry) {
    await recordUse(actor, entry.rule, entry.item, entry.index);
  }

  return entry ?? null;
}
