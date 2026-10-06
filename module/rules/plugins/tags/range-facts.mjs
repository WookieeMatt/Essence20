import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): a ranged attack's distance facts, as dice.mjs#_getAutomaticCombatModifiers works them out for
 * a ranged attack with both tokens on the canvas (it keeps them on the roll's dataset as `rangeFacts` - {distance,
 * normalRange, longRange, longRangeSnagIgnored, elevation}). Every tag answers false (not "unknown") without them, so
 * a rule built on them never turns into a dialog question.
 *
 *   roll:rangeBand:normal        the target is within the weapon's normal Range
 *   roll:rangeBand:long          past normal Range, within its long Range (or with none printed)
 *   roll:longRangeSnagIgnored    something already lifts the long-range Snag (an immune: ["longRangeSnag"] rule, Jury Rig's
 *                                Clean Barrels, Fighting Style: Long Shot)
 *   roll:elevationAbove:<op>N    the attacker's token elevation minus the target's (feet; >= <= > < =)
 *
 * And `WeaponRange {add}` - feet added to the rolled attack's normal and long Range (each only when printed) for these
 * compares, not on the sheet (Trajectory's +30 ft with targeting explosives). `when` sees the roll.
 */

const factsOf = ctx => (ctx?.dataset?.rangeFacts && typeof ctx.dataset.rangeFacts == 'object' ? ctx.dataset.rangeFacts : null);

registerTag('roll:rangeBand', (rest, ctx) => {
  const facts = factsOf(ctx);
  if (!facts || !facts.normalRange) {
    return false;
  }

  if (rest == 'normal') {
    return facts.distance <= facts.normalRange;
  }

  if (rest == 'long') {
    return facts.distance > facts.normalRange && (!facts.longRange || facts.distance <= facts.longRange);
  }

  return null;
}, { phrase: arg => [`at ${arg} range`, `not at ${arg} range`] });

registerTag('roll:longRangeSnagIgnored', (rest, ctx) => !!factsOf(ctx)?.longRangeSnagIgnored, { phrase: ['the long-range Snag is ignored', "the long-range Snag isn't ignored"] });

const compare = (value, op, number) => ({ '>=': value >= number, '<=': value <= number, '>': value > number, '<': value < number, '=': value == number })[op];

registerTag('roll:elevationAbove', (rest, ctx) => {
  const match = /^(>=|<=|>|<|=)(-?\d+)$/.exec(String(rest ?? ''));
  const facts = factsOf(ctx);
  return !!match && !!facts && Number.isFinite(Number(facts.elevation)) && compare(Number(facts.elevation), match[1], Number(match[2]));
}, { phrase: (arg, w) => {
  const match = /^(>=|<=|>|<|=)(-?\d+)$/.exec(arg);
  const words = match && match[1] == '>' && match[2] == '0' ? 'higher than' : match ? `${w.comparison(match[1], match[2])} ft above` : '';
  return match ? [`you are ${words} the target`, `you aren't ${words} the target`] : null;
} });

registerRuleType('WeaponRange', {
  params: { add: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/**
 * Feet the actor's WeaponRange rules add to this attack's printed ranges.
 * @param {Actor} actor
 * @param {Object} roll   {item, rolledSkill, isAttack, isMelee, dataset}
 * @param {Actor|null} target
 */
export function ruleWeaponRange(actor, roll = {}, target = null) {
  let feet = 0;
  for (const { rule, item } of actor ? rulesOfType(actor, 'WeaponRange') : []) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item, other: target })) === true) {
      feet += Math.round(resolveValue(rule.add, { actor, item }, 0));
    }
  }

  return feet;
}
