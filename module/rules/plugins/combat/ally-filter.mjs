// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): AllyFilter.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/combat/nearby-allies.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `AllyFilter {anyDisposition: true}` - the system's ally lookup (mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens, which
 * every "ally within N ft" Perk, ally aura and `ally:` tag uses) counts every nearby token as the holder's ally, whatever
 * its Disposition (Frenemy). `when` sees the actor (keep it to plain actor tags: the ally lookup itself must not be
 * asked from here).
 */
registerRuleType('AllyFilter', {
  params: { anyDisposition: { kind: 'bool', required: true } },
  scopes: ['self'],
});

/**
 * Whether the actor's AllyFilter rules count every token as its ally.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function ruleAnyDispositionAllies(actor) {
  if (!actor) {
    return false;
  }

  return rulesOfType(actor, 'AllyFilter').some(({ rule, item }) => rule.anyDisposition === true
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
}
