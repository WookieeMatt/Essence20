import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `ShiftCap {maxDown}` (round 15, uses) - while `when` holds, the roll's net downshift is never worse than
 * ↓maxDown: once every other automatic modifier is in (dice.mjs, where the hand-written Fanatic cap sat - checked last),
 * an upshift labelled with the rule's label brings the net back to ↓maxDown. The smallest cap counts. `when` sees the
 * roller (self) and the roll's target. Light on imports - dice.mjs loads it.
 */

registerRuleType('ShiftCap', {
  params: { maxDown: { kind: 'number', required: true } },
  scopes: ['self'],
});

/** The balancing source for a roll with these shifts, or null: {id, label, shiftUp, shiftDown: 0, edge: false, snag: false}. */
export function ruleShiftCap(actor, shiftUp, shiftDown, target = null) {
  const caps = rulesOfType(actor, 'ShiftCap')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, other: target })) === true)
    .map(entry => ({ ...entry, max: Math.max(0, Number(entry.rule.maxDown) || 0) }))
    .sort((a, b) => a.max - b.max);
  const cap = caps[0];
  if (!cap || shiftDown - shiftUp <= cap.max) {
    return null;
  }

  return {
    id: `rule-shiftcap-${cap.item?.id ?? 'x'}`, label: cap.rule.label || cap.item?.name || 'ShiftCap',
    shiftUp: shiftDown - shiftUp - cap.max, shiftDown: 0, edge: false, snag: false,
  };
}
