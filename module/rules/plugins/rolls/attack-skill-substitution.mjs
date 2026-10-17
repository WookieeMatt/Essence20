import { RULE_TYPES } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * Round 18 (convA): SkillSubstitution `stage: "attack"` - the swap happens where documents/item.mjs builds a weapon
 * attack's roll (before the Skill's shift, ↑ / ↓ and Specialization are read from the actor), not at the extensions'
 * preRoll the other SkillSubstitution rules use (rules/adapter.mjs#applySkillSubstitution skips these). `from` is the
 * attack's own Skill (its classification Skill, or the weapon's / dataset's override); `mode: bestOf` takes `to` only
 * when its die is better. `when` sees the attack (`item:`, `weapon:`, `attack:melee`) and the first target. Brutal Might:
 * `{type: SkillSubstitution, stage: attack, from: might, to: brawn, mode: bestOf}`.
 */

const SUBSTITUTION = RULE_TYPES.SkillSubstitution;
SUBSTITUTION.params.stage ??= { kind: 'enum', options: ['attack'] };

function shiftRank(actor, skill) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.[skill]?.shift);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * The Skill a weapon attack rolls with, after the roller's stage-attack SkillSubstitution rules.
 * @param {Actor} actor   The roller.
 * @param {Item} item     The weaponEffect being rolled.
 * @param {String} skill  The attack's own Skill.
 * @returns {String}
 */
export function ruleAttackSkill(actor, item, skill) {
  if (!actor || !skill) {
    return skill;
  }

  const entries = [...rulesOfType(actor, 'SkillSubstitution', 'self'), ...linkedEntries(actor, 'SkillSubstitution')]
    .filter(({ rule }) => rule.stage == 'attack' && !rule.disabled);
  const targets = globalThis.game?.user?.targets;
  const other = (targets?.first?.() ?? [...(targets ?? [])][0])?.actor ?? null;
  for (const { rule, item: ruleItem, holder } of entries) {
    if (rule.from != skill || !rule.to || rule.to == skill || !actor.system?.skills?.[rule.to]) {
      continue;
    }

    const isAttack = item?.type == 'weaponEffect';
    const ctx = contextFor({
      item, rolledSkill: skill, isAttack, isMelee: isAttack && item?.system?.classification?.style == 'melee',
      self: actor, holder: holder ?? actor, ruleItem, other,
    });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if (rule.mode == 'bestOf' && shiftRank(actor, rule.to) >= shiftRank(actor, skill)) {
      continue;
    }

    return rule.to;
  }

  return skill;
}
