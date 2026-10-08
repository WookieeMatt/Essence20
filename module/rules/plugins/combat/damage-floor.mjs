import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `DamageFloor {floor}` - the attack's own damage (its damageValue, before Degrees of Success
 * and before any damage bonus is added) is at least `floor` while `when` holds (dice.mjs#rollSkill's damageValue). Not
 * a listed damage bonus. Titan Body: 3 on a Zord's melee attacks. The biggest floor that holds counts.
 */

registerRuleType('DamageFloor', {
  params: { floor: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/** The damage floor the actor's DamageFloor rules put on this attack (0 with none). */
export function ruleDamageFloor(actor, roll = {}) {
  let floor = 0;
  for (const { rule, item } of actor ? rulesOfType(actor, 'DamageFloor') : []) {
    const isAttack = roll.item?.type == 'weaponEffect';
    const ctx = contextFor({ isAttack, isMelee: isAttack && roll.item.system?.classification?.style == 'melee', ...roll, self: actor, holder: actor, ruleItem: item });
    if (evaluate(rule.when, ctx) === true) {
      floor = Math.max(floor, Math.round(resolveValue(rule.floor, { actor, item }, 0)));
    }
  }

  return floor;
}
