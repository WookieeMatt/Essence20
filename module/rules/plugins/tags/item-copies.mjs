import { formulaError, registerRef, resolveValue } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { compare, copiesOf, dataTest, itemsOf, read } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: reading an item's other copies, and formula comparisons.
 *
 *   tag  rule:copy:data:<path>[<op><value>]       some copy of the rule's item on the actor (itself included) has that
 *                                                 data - "any of my Hybridizations is Hold That Shape"
 *   tag  rule:otherCopy:data:<path>[<op><value>]  another copy (not itself) has it - "an earlier pick locks the direction"
 *   ref  @copiesWith.<path>.<value>               how many copies of the rule's item (itself included) hold <value> at
 *                                                 <path> (@copiesWith.flags.essence20.zord2Hybrid.extraShift)
 *   ref  @most.items.<type>.<path>                the biggest number at <path> on the actor's items of that type (0 when none)
 *   tag  calc:<formula><op><number>               a formula compared with a number (calc:@level - @actor.flags.x > 0)
 */

function copyTag(rest, ctx, others) {
  const actor = ctx.self;
  const item = ctx.ruleItem;
  if (!actor || !item) {
    return false;
  }

  const copies = copiesOf(actor, item).filter(copy => !others || (copy !== item && copy.id != item.id));
  const answers = copies.map(copy => dataTest(copy, rest));
  if (answers.some(answer => answer === undefined)) {
    return null;
  }

  return answers.some(answer => answer === true);
}

registerTag('rule:copy', (rest, ctx) => copyTag(rest, ctx, false), { phrase: (arg, w) => [`there's a copy of this item where ${w.items([arg])}`, `there's no copy of this item where ${w.items([arg])}`] });
registerTag('rule:otherCopy', (rest, ctx) => copyTag(rest, ctx, true), { phrase: (arg, w) => [`there's another copy of this item where ${w.items([arg])}`, `there's no other copy of this item where ${w.items([arg])}`] });

registerRef('copiesWith', (key, scope) => {
  const parts = String(key ?? '').split('.');
  const value = parts.pop();
  const path = parts.join('.');
  if (!path || !scope.item) {
    return 0;
  }

  return copiesOf(scope.item.parent ?? scope.actor, scope.item).filter(copy => String(read(copy, path) ?? '') == value).length;
});

registerRef('most', (key, scope) => {
  const [kind, type, ...path] = String(key ?? '').split('.');
  if (kind != 'items' || !type || !path.length) {
    return 0;
  }

  const values = itemsOf(scope.actor).filter(item => item.type == type).map(item => Number(read(item, path.join('.')))).filter(Number.isFinite);
  return values.length ? Math.max(0, ...values) : 0;
});

const CALC = /^(.+?)\s*(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;

/** calc:<formula><op><number>; null when the text isn't one (the validator reports it). */
export function calcTag(rest, ctx) {
  const match = CALC.exec(String(rest ?? ''));
  if (!match || formulaError(match[1])) {
    return null;
  }

  const value = resolveValue(match[1], { actor: ctx.self, item: ctx.ruleItem, vars: ctx.vars, other: ctx.other ?? null }, 0);
  return compare(Number(value), match[2], Number(match[3]));
}

registerTag('calc', calcTag, { family: 'situation', param: 'text', phrase: (arg, w) => w.formula(arg) });
