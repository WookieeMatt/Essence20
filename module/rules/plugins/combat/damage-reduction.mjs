import { registerDamageModifier } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { escape, localize, T } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: `DamageReduction {amount, damageTypes?, limit?, message?}` - damage about to land on the holder (an
 * extensions damage modifier) of one of those types is lowered by `amount` (a formula - 1d2 rolls), never below 0;
 * `limit` counts uses ({per: round} - outside a combat a round limit never runs out, as the combat-stamped helpers read
 * it). `message` (an E20. key or text, {name} and {n}) is posted. `when` sees the holder.
 */

registerRuleType('DamageReduction', {
  params: { amount: { kind: 'formula', required: true }, damageTypes: { kind: 'strings' }, limit: { kind: 'object' }, message: { kind: 'string' } },
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

    if ((rule.damageTypes?.length && !rule.damageTypes.includes(damageType)) || usesLeft(actor, rule, item, index) <= 0
      || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, damageType })) !== true) {
      continue;
    }

    const n = Math.max(0, Math.round(resolveValue(rule.amount, { actor, item }, 0)));
    await recordUse(actor, rule, item, index);
    const line = rule.message ? localize(rule.message, { name: actor.name, n }) : T('Reduced', { name: actor.name, n, item: item?.name ?? '' });
    if (globalThis.ChatMessage?.create) {
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(line)}</p>` });
    }

    value = Math.max(0, value - n);
  }

  return value;
}

registerDamageModifier((actor, amount, damageType) => damageReduction(actor, amount, damageType));
