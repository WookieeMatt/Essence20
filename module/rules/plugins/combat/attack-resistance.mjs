import { isExpired } from "../../expiry.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { itemsOf, sourceOf } from "../../../items/shared/item-lookups.mjs";
import { chosenList } from "../../choice-read.mjs";

/**
 * Round 16 (part a): rule type `AttackResistance {damageTypes}` - while `when` holds, the holder counts as resisting
 * attacks of those damage types for the attacker's Resistance Snag only (dice.mjs, beside the other "live" resistances -
 * Lance of Light, Contempt, Numbness - that sit next to the target's own system.resistances): the Snag, and the roll's
 * roll:dataset:targetResists. It is not a real Resistance entry: the sheet, Ninja Powered: Deep Wisdom and the other
 * readers of system.resistances don't see it. `when` sees the holder (self:) and the attacker (target:); a shield's rule
 * only counts while the shield is equipped, `rule:data:system.active` while it is raised (Dispersion).
 */

/*
 * Round 17 (split1 - docs/rules-batches/slSplit117.md): the resisted types may come from elsewhere instead of
 * `damageTypes` -
 *   choiceOf: <uuid>   the damage type chosen (system.choice) on the actor's copy of that item; "energy" stands for every
 *                      Energy type (combat.mjs ENERGY_DAMAGE_TYPES) - Numbness's extra type picked through Stone Warlord;
 *   fromMark: <key>    the text of the holder's own mark under that key (a `mark {text: "{choice.type}"}` step);
 *                      consumeMark: true - the mark comes off the first time an attack of that type is weighed against
 *                      it (even when another Resistance already gives the Snag) - Righteous Heart's banked Resistance.
 */
registerRuleType('AttackResistance', {
  params: { damageTypes: { kind: 'strings' }, choiceOf: { kind: 'string' }, fromMark: { kind: 'string' }, consumeMark: { kind: 'bool' } },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.damageTypes) && rule.damageTypes.length) || rule.choiceOf || rule.fromMark ? [] : ['needs damageTypes, choiceOf or fromMark'],
    ...(rule.consumeMark && !rule.fromMark ? ['consumeMark goes with fromMark'] : []),
  ],
});

// The same list as mechanics/combat/combat.mjs ENERGY_DAMAGE_TYPES (kept here so this file stays light to import).
const ENERGY_TYPES = new Set(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);

/** The holder's live (unexpired) mark under the key, or null. */
function liveMark(actor, key) {
  const mark = actor?.flags?.essence20?.ruleMarks?.[key];
  if (!mark) {
    return null;
  }

  return isExpired(mark) ? null : mark;
}

/** Whether one AttackResistance rule covers this damage type. */
function covers(rule, target, damageType) {
  if ((rule.damageTypes ?? []).includes(damageType)) {
    return true;
  }

  if (rule.choiceOf) {
    // The copy's pick (rules/choice-read.mjs); a list pick covers each of its entries.
    const picks = chosenList(itemsOf(target).find(item => sourceOf(item) == rule.choiceOf));
    if (picks.some(choice => choice && (choice == damageType || (choice == 'energy' && ENERGY_TYPES.has(damageType))))) {
      return true;
    }
  }

  return !!rule.fromMark && !!damageType && liveMark(target, rule.fromMark)?.text == damageType;
}

/**
 * Whether the target resists an attack of this damage type through its AttackResistance rules.
 * @param {Actor} target
 * @param {String} damageType
 * @param {Actor} [attacker]
 * @returns {Boolean}
 */
export function ruleResistsAttack(target, damageType, attacker = null) {
  if (!target || !damageType) {
    return false;
  }

  // Every rule is asked (not just up to the first that resists), so each consumeMark mark that covers the attack goes.
  let resists = false;
  for (const { rule, item } of rulesOfType(target, 'AttackResistance', 'self')) {
    if (!covers(rule, target, damageType)
      || evaluate(rule.when, contextFor({ self: target, holder: target, ruleItem: item, other: attacker })) !== true) {
      continue;
    }

    resists = true;
    // Written without waiting (this is read while the roll's automatic modifiers are worked out, which isn't async).
    if (rule.consumeMark && rule.fromMark) {
      Promise.resolve(target.update?.({ [`flags.essence20.ruleMarks.${rule.fromMark}`]: new foundry.data.operators.ForcedDeletion() })).catch(() => {});
    }
  }

  return resists;
}
