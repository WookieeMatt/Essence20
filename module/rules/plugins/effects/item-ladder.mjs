import { registerDerived } from "../../../mechanics/item-hooks.mjs";
import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, unknownTags } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { getPath, itemsOf } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * Equipment rules (round 10, group C) - BrawnRequirement is in ./brawn.mjs:
 *
 * - `ItemLadder` {items, path, by, from?, floor?} - moves a die stored on the actor's other items along
 *   CONFIG.E20.weaponRequirementShiftLadder (none, d2, d4 ... 3d6): `by` steps (negative: down), never below
 *   `floor` (a die already at or below it is left alone). `from` is read when `path` holds nothing yet.
 *   Balance and Compensation's "two die sizes lower".
 */

registerRuleType('ItemLadder', {
  params: {
    items: { kind: 'object', required: true }, path: { kind: 'string', required: true }, by: { kind: 'formula', required: true },
    from: { kind: 'string' }, floor: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.items) && rule.items.length ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : ['items must be a list of item: tags']),
    ...(String(rule.path ?? '').startsWith('system.') ? [] : ['path must start with system.']),
  ],
});

const LADDER = () => globalThis.CONFIG?.E20?.weaponRequirementShiftLadder ?? ['none', 'd2', 'd4', 'd6', 'd8', 'd10', 'd12', '2d8', '3d6'];

/** One die moved `by` steps along the ladder, not below `floor` (a die at or below it stays). */
export function ladderStep(die, by, floor = null) {
  const ladder = LADDER();
  const index = ladder.indexOf(die);
  if (index < 0 || !by) {
    return die;
  }

  const bottom = floor ? Math.max(0, ladder.indexOf(floor)) : 0;
  if (by < 0 && index <= bottom) {
    return die;
  }

  return ladder[Math.min(ladder.length - 1, Math.max(by < 0 ? bottom : 0, index + by))];
}

export function ruleItemLadders(actor) {
  const setProperty = globalThis.foundry?.utils?.setProperty ?? ((object, key, value) => {
    const keys = key.split('.');
    const last = keys.pop();
    keys.reduce((at, part) => (at[part] ??= {}), object)[last] = value;
  });
  for (const { rule, item } of rulesOfType(actor, 'ItemLadder', 'self')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item, combat: null })) !== true) {
      continue;
    }

    const by = Math.round(resolveValue(rule.by, { actor, item }, 0));
    for (const other of itemsOf(actor)) {
      if (other === item || evaluate(rule.items, contextFor({ self: actor, item: other, ruleItem: item, combat: null })) !== true) {
        continue;
      }

      const current = getPath(other, rule.path) ?? (rule.from ? getPath(other, rule.from) : undefined);
      if (typeof current != 'string') {
        continue;
      }

      const next = ladderStep(current, by, rule.floor ?? null);
      if (next != current || getPath(other, rule.path) === undefined) {
        setProperty(other, rule.path, next);
      }
    }
  }
}

registerDerived(ruleItemLadders);
