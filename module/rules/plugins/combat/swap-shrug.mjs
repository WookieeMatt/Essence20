import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `SwapShrug {from, to}` (round 15, uses) - on the defender: an attack it resisted with Defense `to` when it was
 * aimed at Defense `from` brings only its damage - the secondary damage and the on-hit Conditions are dropped
 * (mechanics/combat/target-riders.mjs#attackRiders, with a note on the card row). `when` sees the defender as self: and
 * the attacker as target:. Unstoppable Force (from evasion, to toughness, self:wearing>=heavy).
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

registerRuleType('SwapShrug', {
  params: { from: { kind: 'enum', required: true, options: DEFENSES }, to: { kind: 'enum', required: true, options: DEFENSES } },
  scopes: ['self'],
});

/** The defender's rule item that shrugs off this hit's extras (resisted with `used` instead of `suggested`), or null. */
export function ruleSwapShrug(defender, used, suggested, attacker = null) {
  if (!defender || !used || !suggested || used == suggested) {
    return null;
  }

  return rulesOfType(defender, 'SwapShrug').find(({ rule, item }) => rule.from == suggested && rule.to == used
    && evaluate(rule.when, contextFor({ self: defender, ruleItem: item, other: attacker })) === true)?.item ?? null;
}
