import { registerRef } from "../../formula.mjs";
import { evaluateTag, registerTag } from "../../predicate.mjs";
import { resolveUuid } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * A picked item in later steps (round 10, group C) - after `pick from: targetItem` (or ownedItem):
 *
 * - `@availDif.<key>` - the Requisition Difficulty of the item picked under <key> (CONFIG.E20.availabilityDifficulties
 *   of its combined Availability; a Kit's from the first word of its name, standard when there's none). Deconstruct's
 *   Technology test.
 * - `rule:pickedItem:<key>:<item tags joined by &>` - the item picked under <key> meets the tags (a step's `when`):
 *   rule:pickedItem:victim:item:type:gear&item:word:kit.
 */

const KIT_TIERS = ['standard', 'limited', 'restricted', 'prototype', 'unique', 'theoretical'];

/** The item a pick stored on the rule's item, or null. */
export function pickedItem(ruleItem, key) {
  const stored = ruleItem?.flags?.essence20?.rules?.choices?.[key];
  if (!stored) {
    return null;
  }

  return resolveUuid(stored) ?? ruleItem?.parent?.items?.get?.(stored) ?? null;
}

export function availabilityDif(item) {
  const first = String(item?.name ?? '').split(/\s+/)[0]?.toLowerCase();
  const tier = item?.system?.totalAvailability ?? item?.system?.availability ?? (KIT_TIERS.includes(first) ? first : 'standard');
  return Number(globalThis.CONFIG?.E20?.availabilityDifficulties?.[tier]) || 0;
}

registerRef('availDif', (key, scope) => availabilityDif(pickedItem(scope.item, key)));

registerTag('rule:pickedItem', (rest, ctx) => {
  const [key, ...more] = rest.split(':');
  const item = pickedItem(ctx.ruleItem, key);
  if (!item) {
    return false;
  }

  const tags = more.join(':').split('&').filter(Boolean);
  return tags.every(tag => evaluateTag(tag, { ...ctx, item }) === true);
});
