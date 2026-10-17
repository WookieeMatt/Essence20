// Round 15 (items1): rule type FanningShots - Storm of Lead.
import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * `FanningShots {extraShots?, firstShotUpshift?}` - a Fanning (X) weapon's volley (items/attacks/fanning.mjs): `extraShots`
 * is added to X (getFanningMaxShots), `firstShotUpshift` is a ↑ on the volley's first shot only (dice.mjs's first fanned
 * shot and the repeat loop's shot 1). Several rules add up. `when` sees the actor and (as `item:`) the Fanning weapon.
 */
registerRuleType('FanningShots', {
  params: { extraShots: { kind: 'formula' }, firstShotUpshift: { kind: 'formula' } },
  scopes: ['self'],
  validate: rule => (rule.extraShots === undefined && rule.firstShotUpshift === undefined ? ['needs extraShots or firstShotUpshift'] : []),
});

/**
 * The actor's FanningShots rules added up: {extraShots, firstShotUpshift}.
 * @param {Actor} actor
 * @param {?Item} [weapon]   The Fanning weapon (item: tags).
 */
export function fanningShotRules(actor, weapon = null) {
  const out = { extraShots: 0, firstShotUpshift: 0 };
  for (const { rule, item } of rulesOfType(actor, 'FanningShots')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item, item: weapon })) !== true) {
      continue;
    }

    out.extraShots += Math.round(resolveValue(rule.extraShots ?? 0, { actor, item }, 0));
    out.firstShotUpshift += Math.round(resolveValue(rule.firstShotUpshift ?? 0, { actor, item }, 0));
  }

  return out;
}
