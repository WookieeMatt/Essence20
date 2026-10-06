// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): ContactAllegiance.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/companions/contacts.mjs loads it directly.
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `ContactAllegiance {amount}` - a Contact the holder summons arrives with `amount` (a formula) more Allegiance Points
 * (mechanics/companions/contacts.mjs#summonContact, beside Contact Connection's and Hometown Hero's). `when` sees the
 * summoner as `self:` and the Contact as `target:` - Gridlock Authority: `target:data:flags.essence20.government`.
 */
registerRuleType('ContactAllegiance', {
  params: { amount: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/**
 * The Allegiance Points the summoner's ContactAllegiance rules add for this Contact (0 with none).
 * @param {Actor} summoner
 * @param {Actor} contact
 * @returns {Number}
 */
export function ruleContactAllegiance(summoner, contact) {
  let total = 0;
  for (const { rule, item } of rulesOfType(summoner, 'ContactAllegiance')) {
    if (evaluate(rule.when, contextFor({ self: summoner, other: contact, ruleItem: item })) === true) {
      total += Math.round(Number(resolveValue(rule.amount, { actor: summoner, item }, 0)) || 0);
    }
  }

  return total;
}
