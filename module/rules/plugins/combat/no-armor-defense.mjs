import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Defense `mode: "noArmor"` (outgoing only - round 15, systems, docs/rules-batches/slSystems15.md): the attack meets the
 * target's Defense worked out again without its armor (mechanics/combat/combat.mjs#getDefenseValue with ignoreArmor) -
 * the difficulty is REPLACED at the point in dice.mjs where the hand-written armor-ignoring attacks (Drilling Shot,
 * Quantum Cut, Armor Piercing...) recompute it, so the per-target changes made before that point (a Shield Upgrade's
 * bonus...) are dropped the way theirs are, and the ones after it still apply. (`ignoreArmor` instead subtracts the
 * armor share from the difficulty as it stands, later on.) `defense` narrows the attacked Defense (`any` for every one);
 * `when` sees the attack (`weapon:trait:martialArts`), self = the attacker, other = the target. Never on the sheet.
 */

const DEFENSE = RULE_TYPES.Defense;
if (!DEFENSE.params.mode.options.includes('noArmor')) {
  DEFENSE.params.mode.options.push('noArmor');
}

{
  const inner = DEFENSE.validate;
  DEFENSE.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.mode == 'noArmor' && !rule.outgoing ? ['noArmor needs outgoing: true (it changes the target\'s Defense)'] : []),
  ];
}

/**
 * Whether one of the attacker's noArmor Defense rules holds for this attack on this defender.
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defenseType   The Defense the attack is compared against.
 * @param {Object} [ctx]   {item, rolledSkill, rolledEssence}
 * @returns {Boolean}
 */
export function ruleNoArmor(attacker, defender, defenseType, ctx = {}) {
  if (!attacker || !defender) {
    return false;
  }

  const isAttack = ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: isAttack && ctx.item?.system?.classification?.style == 'melee', defenseType };
  // (A markedTarget rule acts for attacks on the creature carrying its mark - rules/plugins/combat/marked-no-armor.mjs.)
  return rulesOfType(attacker, 'Defense').some(({ rule, item }) => rule.mode == 'noArmor' && rule.outgoing && rule.scope != 'markedTarget'
    && (rule.defense == 'any' || rule.defense == defenseType)
    && evaluate(rule.when, contextFor({ ...facts, self: attacker, holder: attacker, ruleItem: item, other: defender })) === true);
}
