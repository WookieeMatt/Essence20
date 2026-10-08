// Round 15 (systems - docs/rules-batches/slSystems15.md): ChoiceCount.
// Import-light: sheet-handlers/perk-handler.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRef } from "../../formula.mjs";
import { registerRuleType } from "../../types.mjs";
import { sourceOf } from "../../../items/shared/item-lookups.mjs";

/**
 * `ChoiceCount {items, add}` - while the holder has it, the listed Perks (compendium uuids) offer `add` more picks in
 * their own drop-time picker (sheet-handlers/perk-handler.mjs#setPerkValues - system.numChoices). Several add up. Grid
 * Tap: one more Grid Science / Grid Tech bonus. `when` sees the holder.
 */
registerRuleType('ChoiceCount', {
  params: { items: { kind: 'strings', required: true }, add: { kind: 'number', required: true } },
  scopes: ['self'],
});

/**
 * How many more picks the Perk being set up offers.
 * @param {Actor} actor
 * @param {String} perkUuid   The Perk's compendium uuid.
 * @returns {Number}
 */
export function ruleChoiceCountBonus(actor, perkUuid) {
  if (!actor || !perkUuid) {
    return 0;
  }

  return rulesOfType(actor, 'ChoiceCount')
    .filter(({ rule, item }) => (rule.items ?? []).includes(perkUuid)
      && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true)
    .reduce((total, { rule }) => total + Math.max(0, Math.round(Number(rule.add) || 0)), 0);
}

/**
 * `@choiceCount` (Perk choice P1): how many more picks the rule's item offers - the ChoiceCount `add`s naming its book
 * source (ruleChoiceCountBonus), 0 with no actor or no source. A ChoiceSet / pickSubPerk `count: "2 + @choiceCount"` keeps
 * Grid Tap's extra Grid Science / Grid Tech pick.
 */
registerRef('choiceCount', (key, scope) => ruleChoiceCountBonus(scope.actor, sourceOf(scope.item)));
