import { registerDamageModifier } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate, markOf } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape, localize, T } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: `DamageReduction {amount, damageTypes?, limit?, message?}` - damage about to land on the holder (an
 * extensions damage modifier) of one of those types is lowered by `amount` (a formula - 1d2 rolls), never below 0;
 * `limit` counts uses ({per: round} - outside a combat a round limit never runs out, as the combat-stamped helpers read
 * it). `message` (an E20. key or text, {name} and {n}) is posted. `when` sees the holder.
 */

registerRuleType('DamageReduction', {
  // Round 15 (uses): minDamage - only damage of at least that much; counter {path, max} - only while the number the rule's
  // item keeps at `path` is below `max`, counting one up each time (reset by whatever sets it back - a Use); quiet - no
  // chat line. (Protomatter Injection Layer.)
  params: { amount: { kind: 'formula', required: true }, damageTypes: { kind: 'strings' }, limit: { kind: 'object' }, message: { kind: 'string' },
    minDamage: { kind: 'number' }, counter: { kind: 'object' }, quiet: { kind: 'bool' },
    // Round 15 (items1): consumeMark - only while the holder carries that mark, which the reduction uses up (a one-shot
    // "ignore the next 1 damage" - Dig Deep, Self-Preservation).
    consumeMark: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => (rule.limit !== undefined && !['turn', 'round', 'scene', 'encounter', 'mission'].includes(rule.limit?.per)
    ? ['limit.per must be turn, round, scene, encounter or mission'] : []),
});

/** Damage about to land on `actor` after its DamageReduction rules. */
export async function damageReduction(actor, amount, damageType) {
  let value = amount;
  for (const { rule, item, index } of rulesOfType(actor, 'DamageReduction')) {
    if (!(value > 0)) {
      break;
    }

    const counted = rule.counter?.path ? Number(globalThis.foundry?.utils?.getProperty?.(item, rule.counter.path)) || 0 : 0;
    if ((rule.minDamage !== undefined && value < Number(rule.minDamage)) || (rule.counter?.path && counted >= Number(rule.counter.max ?? 1))
      || (rule.damageTypes?.length && !rule.damageTypes.includes(damageType)) || usesLeft(actor, rule, item, index) <= 0
      || (rule.consumeMark && !markOf(actor, rule.consumeMark))
      || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, damageType })) !== true) {
      continue;
    }

    const n = Math.max(0, Math.round(resolveValue(rule.amount, { actor, item }, 0)));
    await recordUse(actor, rule, item, index);
    if (rule.consumeMark) {
      await actor.update({ [`flags.essence20.ruleMarks.-=${rule.consumeMark}`]: null });
    }

    if (rule.counter?.path) {
      await item.update({ [rule.counter.path]: counted + 1 });
    }

    const line = rule.message ? localize(rule.message, { name: actor.name, n }) : T('Reduced', { name: actor.name, n, item: item?.name ?? '' });
    if (globalThis.ChatMessage?.create && !rule.quiet) {
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(line)}</p>` });
    }

    value = Math.max(0, value - n);
  }

  return value;
}

registerDamageModifier((actor, amount, damageType) => damageReduction(actor, amount, damageType));
