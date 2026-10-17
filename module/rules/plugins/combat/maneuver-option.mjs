import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `ManeuverOption {option: disarm|dismantle}` (round 15, uses):
 *   - `disarm` - the Maneuver choice an attack's Maneuver effect offers once it hits (dice.mjs: grapple, shove, trip) gains
 *     disarm (Snatch: a held weapon of up to two hands is knocked loose, mechanics/combat/target-riders.mjs#disarm).
 *   - `dismantle` - once this actor disarms someone of a weapon (any disarm), it may pull it apart instead
 *     (target-riders.mjs#disarm's prompt: useless this combat until a DIF 20 Technology test reassembles it). `when` sees
 *     the dropped weapon as item: (Dismantle Firearm: item:trait:ballistic / reload).
 * `when` sees the attacker. Light on imports - dice.mjs loads it.
 */

registerRuleType('ManeuverOption', {
  params: { option: { kind: 'enum', required: true, options: ['disarm', 'dismantle'] } },
  scopes: ['self'],
});

/** The rule item granting that option (its name labels the disarm / the prompt), or null. `item`: the weapon in question. */
export function ruleManeuverOption(actor, option, item = null) {
  return rulesOfType(actor, 'ManeuverOption').find(({ rule, item: ruleItem }) => rule.option == option
    && evaluate(rule.when, contextFor({ self: actor, ruleItem, item })) === true)?.item ?? null;
}
