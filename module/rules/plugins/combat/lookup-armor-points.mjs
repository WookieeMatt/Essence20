// Rules-engine plug-ins, round 17 (split1 - docs/rules-batches/slSplit117.md): Defense ignoreArmor `lookup`.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Defense `{mode: ignoreArmor, outgoing: true, points, lookup: true}` - the points of armor the attack ignores are taken
 * off where dice.mjs first looks the target's Defense up (mechanics/combat/combat.mjs#getDefenseValue's
 * ignoreArmorPoints), not added afterwards with the other per-attack changes (rules/plugins/combat/ignore-armor.mjs
 * leaves these alone). So an attack that ignores the armor outright anyway (a ticked ignoreArmor key, Void, a later
 * Armor Piercing / noArmor recompute) doesn't take the points off a second time. The biggest such rule counts. `when`
 * sees the roll (roll:switch:<key> for a DialogSwitch key) and the target (target:). Metallikato's Bot Mode switch.
 */

const DEFENSE = RULE_TYPES.Defense;
DEFENSE.params.lookup ??= { kind: 'bool' };
{
  const inner = DEFENSE.validate;
  DEFENSE.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.lookup && (rule.mode != 'ignoreArmor' || rule.points === undefined) ? ['lookup goes with mode ignoreArmor and points'] : []),
  ];
}

/**
 * The armor points the attacker's lookup rules ignore on this Defense (0 with none).
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defenseType
 * @param {Object} roll   {item, rolledSkill, rolledEssence, switches}
 * @returns {Number}
 */
export function ruleLookupArmorPoints(attacker, defender, defenseType, roll = {}) {
  let best = 0;
  if (!attacker) {
    return best;
  }

  for (const { rule, item } of rulesOfType(attacker, 'Defense')) {
    if (!rule.lookup || rule.mode != 'ignoreArmor' || !rule.outgoing || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    const facts = { ...roll, isAttack: roll.isAttack ?? roll.item?.type == 'weaponEffect', isMelee: roll.isMelee ?? roll.item?.system?.classification?.style == 'melee' };
    if (evaluate(rule.when, contextFor({ ...facts, defenseType, self: attacker, holder: attacker, ruleItem: item, other: defender })) !== true) {
      continue;
    }

    best = Math.max(best, Math.max(0, Math.round(resolveValue(rule.points, { actor: attacker, item }, 0))));
  }

  return best;
}
