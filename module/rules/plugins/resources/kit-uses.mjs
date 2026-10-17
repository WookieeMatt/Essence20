// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): KitUses.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/resources/kits.mjs loads it directly.
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

const TIERS = ['standard', 'limited', 'restricted', 'prototype', 'theoretical'];

/**
 * `KitUses {uses, tiers?}` - a kit of one of those tiers (default: every tier) is used up only after `uses` uses
 * (mechanics/resources/kits.mjs#consumeKit counts them on the kit, flags.essence20.kitUses). With several rules the most
 * uses wins; with none a kit lasts one use. `when` sees the actor. Reinforced Basics: `{uses: 3, tiers: ["standard"]}`.
 */
registerRuleType('KitUses', {
  params: { uses: { kind: 'formula', required: true }, tiers: { kind: 'strings' } },
  scopes: ['self'],
  validate: rule => ((rule.tiers ?? []).every(tier => TIERS.includes(tier)) ? [] : [`tiers must be among ${TIERS.join(', ')}`]),
});

/**
 * How many uses a kit of this tier has for the actor (at least 1).
 * @param {Actor} actor
 * @param {String} tier
 * @returns {Number}
 */
export function ruleKitUses(actor, tier) {
  let uses = 1;
  for (const { rule, item } of rulesOfType(actor, 'KitUses')) {
    if ((Array.isArray(rule.tiers) && rule.tiers.length && !rule.tiers.includes(tier))
      || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    uses = Math.max(uses, Math.round(Number(resolveValue(rule.uses, { actor, item }, 1)) || 1));
  }

  return uses;
}
