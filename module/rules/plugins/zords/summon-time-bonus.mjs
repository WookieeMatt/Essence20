// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): SummonTimeBonus.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/vehicles/zord-summon.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SummonTimeBonus {amount, sceneAllies?}` - a summoned Zord's rolled arrival time (3d2) is `amount` rounds shorter
 * (never below 1), before the SummonTime rules (mechanics/vehicles/zord-summon.mjs#rollSummonTimer). The summoner's
 * own rule, or - `sceneAllies: true` - one held by any other token on the viewed scene with the summoner's token
 * Disposition. Several don't stack: the biggest applies (Enhanced Summoner's flat -1). `when` sees the holder.
 */
registerRuleType('SummonTimeBonus', {
  params: { amount: { kind: 'formula', required: true }, sceneAllies: { kind: 'bool' } },
  scopes: ['self'],
});

function bonusOf(holder, onlySceneAllies) {
  let best = 0;
  for (const { rule, item } of rulesOfType(holder, 'SummonTimeBonus')) {
    if ((onlySceneAllies && !rule.sceneAllies) || evaluate(rule.when, contextFor({ self: holder, holder, ruleItem: item })) !== true) {
      continue;
    }

    best = Math.max(best, Math.round(Number(resolveValue(rule.amount, { actor: holder, item }, 0)) || 0));
  }

  return best;
}

/**
 * How many rounds the SummonTimeBonus rules reaching this summoner take off the rolled arrival time.
 * @param {Actor} summoner
 * @returns {Number}
 */
export function ruleSummonTimeBonus(summoner) {
  if (!summoner) {
    return 0;
  }

  let best = bonusOf(summoner, false);
  const own = summoner.getActiveTokens?.()?.[0];
  if (own && globalThis.canvas?.tokens) {
    for (const token of globalThis.canvas.tokens.placeables ?? []) {
      if (token !== own && token.actor && token.document?.disposition === own.document?.disposition) {
        best = Math.max(best, bonusOf(token.actor, true));
      }
    }
  }

  return best;
}
