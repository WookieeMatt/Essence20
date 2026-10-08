import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";

/**
 * `ActionSkills` {action, skills, limit?} (round 10, group C) - more Skills a named action may be rolled with: `heal`,
 * the "restore Health with a Skill Test" action (mechanics/actions/heal-action.mjs#healSkills). While `when` holds
 * and the limit has a use left, the action offers `skills` too; picking one of them uses the limit up. Hearty Meal.
 *
 * Kept light on imports: medic.mjs reads it.
 */

export const SKILL_ACTIONS = ['heal'];

registerRuleType('ActionSkills', {
  params: { action: { kind: 'enum', required: true, options: SKILL_ACTIONS }, skills: { kind: 'strings', required: true }, limit: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.skills) && rule.skills.length ? [] : ['skills must list at least one Skill']),
});

/**
 * The ActionSkills rules that apply to an action now: [{skills, rule, item, index}].
 * @param {Actor} actor
 * @param {String} action
 * @param {Object} [options]
 * @param {?Object} [options.combat]   The combat to read `combat:` tags against (default game.combat).
 */
export function ruleActionSkills(actor, action, { combat = undefined } = {}) {
  return rulesOfType(actor, 'ActionSkills', 'self')
    .filter(({ rule }) => rule.action == action)
    .filter(({ rule, item, index }) => !(rule.limit?.per && usesLeft(actor, rule, item, index) <= 0))
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, ...(combat === undefined ? {} : { combat }) })) === true)
    .map(entry => ({ ...entry, skills: entry.rule.skills }));
}

/** The action was taken with `skill`: the limits of the rules that offered it are used up. */
export async function spendActionSkill(actor, action, skill, options = {}) {
  for (const { rule, item, index, skills } of ruleActionSkills(actor, action, options)) {
    if (skills.includes(skill) && rule.limit?.per) {
      await recordUse(actor, rule, item, index);
    }
  }
}
