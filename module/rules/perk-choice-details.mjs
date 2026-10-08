/**
 * What a Perk's Details tab shows of the old Perk picker (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.5, Perk choice P3).
 * The old inputs (hasChoice, choiceType, numChoices, choiceEssence, value) are gone from the tab: every pack item asks
 * its pick through rules, and the pick shows on the Rules tab with its "change" button. Left on the Details tab:
 *  - a read-only "Legacy choice" notice for an item that still says hasChoice (a homebrew world item never converted,
 *    or a copy whose old pick the world migration couldn't match);
 *  - the sub-Perk choice list (system.items), only for an item whose rules pick its sub-Perks (a pickSubPerk step),
 *    or a legacy item whose old choice type is 'perks' (the old picker still reads the list until 6.1).
 * Plain Node safe: imports only other pure rules modules.
 */

import { hasRulesPick, hasSubPerkPick } from "./choice-checks.mjs";
import { chosenList } from "./choice-read.mjs";

/**
 * @param {Item|Object} item           The Perk (a document or plain data).
 * @param {Object} [choiceTypes]       Labels by old choice type (CONFIG.E20.perkChoiceTypes, pre-localized).
 * @returns {{legacyChoice: ({type: String, typeLabel: String, value: String, converted: Boolean}|null), showSubPerkList: Boolean}}
 */
export function perkChoiceDetails(item, choiceTypes = {}) {
  const system = item?.system ?? {};
  const legacy = system.hasChoice === true;
  const type = system.choiceType ?? '';

  return {
    legacyChoice: legacy ? {
      type,
      typeLabel: choiceTypes?.[type] ?? type,
      value: chosenList(item).join(', '),
      // A converted item (its rules ask the pick) whose old value wasn't carried over: re-pick on the Rules tab.
      converted: hasRulesPick(item),
    } : null,
    showSubPerkList: hasSubPerkPick(item) || (legacy && type == 'perks'),
  };
}
