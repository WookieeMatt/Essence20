import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { registerImmunityKind } from "../rolls/immunity-kinds.mjs";

/**
 * Round 15 (dice part): the attacker's say over the Defense an attack targets, in dice.mjs's per-target Defense choice.
 *
 *   DefenseSwap {from, to}               (on the attacker) a target that would use `from` uses `to` instead - after
 *                                        Fly In The Future and TargetedDefense, before Superstructure. `when` sees the
 *                                        roll (roll:switch:<key> for a dialog switch's key), the target as the other
 *                                        party; `from: any` for every Defense. Fast Draw: a `fastDraw` switch, then
 *                                        evasion -> toughness; Quantum Cut: any -> toughness.
 *   RollModifier immune: evasiveManeuvers  the target's Evasive Maneuvers (Fly In The Future) doesn't turn this attack
 *                                        onto its Evasion (Anti-Air Combat Training).
 *   RollModifier immune: voidArmorIgnore    (scope incoming, on the target) the Void trait's "ignores armor bonuses to
 *                                        Toughness" doesn't apply against it (Voidshield).
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
registerRuleType('DefenseSwap', {
  params: {
    from: { kind: 'enum', required: true, options: [...DEFENSES, 'any'] },
    to: { kind: 'enum', required: true, options: DEFENSES },
  },
  scopes: ['self'],
});

registerImmunityKind('evasiveManeuvers');
registerImmunityKind('voidArmorIgnore');

/**
 * The Defense `defense` becomes under the attacker's DefenseSwap rules (the first that holds for it), else `defense`.
 * @param {Actor} actor     The attacker.
 * @param {?Actor} target
 * @param {Object} roll     {item, rolledSkill, rolledEssence, dataset, switches}
 * @param {String} defense  The Defense resolved so far.
 */
export function ruleDefenseSwap(actor, target, roll = {}, defense = null) {
  for (const { rule, item } of actor && defense ? rulesOfType(actor, 'DefenseSwap') : []) {
    if ((rule.from != 'any' && rule.from != defense) || rule.to == defense) {
      continue;
    }

    const isAttack = roll.item?.type == 'weaponEffect';
    const ctx = contextFor({ isAttack, isMelee: isAttack && roll.item.system?.classification?.style == 'melee', ...roll, self: actor, holder: actor, ruleItem: item, other: target });
    if (evaluate(rule.when, ctx) === true) {
      return rule.to;
    }
  }

  return defense;
}
