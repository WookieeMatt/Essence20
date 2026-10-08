import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { ruleLabel } from "../../index.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `SnagOrMiss {limit?}` (on a defender) - a roll made against the holder gets a Snag, or misses
 * outright when it already has a Snag. Asked in dice.mjs#_getAutomaticCombatModifiers after every other Snag source of
 * the roll (riders and item rules included); `when` sees self = the holder, other = the roller, the roll's item. One
 * use of the limit for the two branches together, spent once the roll goes ahead (the dialog wasn't cancelled). Move
 * Like a Song: `{limit: {per: round}, when: [combat:exists]}` - the first roll against you each round.
 */

registerRuleType('SnagOrMiss', {
  params: { limit: { kind: 'object' } },
  scopes: ['self'],
});

/**
 * The first SnagOrMiss rule on `target` that holds for this roll and has a use left, or null.
 * @param {Actor} actor    The roller.
 * @param {?Actor} target
 * @param {Object} roll   {item, rolledSkill, rolledEssence, dataset}
 * @returns {?{label: String, spend: Object}}
 */
export function ruleSnagOrMiss(actor, target, roll = {}) {
  for (const { rule, item, index } of target ? rulesOfType(target, 'SnagOrMiss') : []) {
    if (rule.limit?.per && usesLeft(target, rule, item, index) <= 0) {
      continue;
    }

    const isAttack = roll.item?.type == 'weaponEffect';
    const ctx = contextFor({ isAttack, isMelee: isAttack && roll.item.system?.classification?.style == 'melee', ...roll, self: target, holder: target, ruleItem: item, other: actor });
    if (evaluate(rule.when, ctx) === true) {
      return { label: ruleLabel(rule, item), spend: { target, rule, item, index } };
    }
  }

  return null;
}

/** Spend the use of the SnagOrMiss rule ruleSnagOrMiss picked (its `spend`). */
export async function spendSnagOrMiss(spend) {
  if (spend?.rule?.limit?.per) {
    await recordUse(spend.target, spend.rule, spend.item, spend.index);
  }
}
