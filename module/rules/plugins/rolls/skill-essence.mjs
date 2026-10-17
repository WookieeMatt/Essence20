import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `SkillEssence {essence}` - while `when` holds the roll counts as one of that Essence (its
 * Essence shifts, `essence:` tags, Specializations keyed on the Essence...) instead of the Skill's own. Read by
 * dice.mjs#rollSkill right where it settles `rolledEssence` (before the automatic modifiers), overriding even an Essence
 * the dataset named. `when` sees the rolled Skill (`skill:`) and item; the first matching rule wins. Academic Studies:
 * `{essence: "smarts", when: ["skill:{item.choice}"]}`. Import-light: dice.mjs loads this file directly.
 */

export const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

registerRuleType('SkillEssence', {
  params: { essence: { kind: 'enum', options: ESSENCES, required: true } },
  scopes: ['self'],
});

/** The Essence a SkillEssence rule makes this roll use, or null. `roll` is {rolledSkill, item, dataset}. */
export function ruleSkillEssence(actor, roll = {}) {
  if (!actor) {
    return null;
  }

  const found = rulesOfType(actor, 'SkillEssence').find(({ rule, item }) => ESSENCES.includes(rule.essence)
    && evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) === true);
  return found?.rule.essence ?? null;
}
