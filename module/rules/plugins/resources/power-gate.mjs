// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the PowerGate rule type.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/characters/power-use.mjs loads it directly.
import { rulesOf } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `PowerGate {when}` on a Power - its activation button (the sheet's canUsePower helper,
 * mechanics/characters/power-use.mjs) shows only while `when` holds (self = the Power's holder). A Power whose own
 * powerUsed Trigger has a limit gates on it with `self:limitUsed:<limit.key>:<per>`: Zeo Crystal Boost is
 * `{type: PowerGate, when: ["not:self:limitUsed:zeoCrystalBoost:encounter"]}` beside a powerUsed Trigger with
 * `limit: {per: encounter, key: zeoCrystalBoost}`. A Power with no PowerGate is ungated.
 */
registerRuleType('PowerGate', { params: {}, scopes: ['self'] });

/** Whether the Power's own PowerGate rules let it be activated now. */
export function powerGateOpen(power, actor = power?.parent) {
  return rulesOf(power).every(rule => rule?.type != 'PowerGate' || rule.disabled
    || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: power, item: power })) === true);
}
