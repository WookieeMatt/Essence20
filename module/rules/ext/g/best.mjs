import { registerDerived } from "../../../helpers/extensions.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, unknownTags } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { getPath, itemsOf } from "./common.mjs";

/**
 * OnlyBest {defense, items, path?, key?} (round 11, group G) - of the actor's items matching `items` (item tags), only
 * the one with the biggest bonus counts toward that Defense: derived data takes every other one's bonus (the number
 * at `path`, default system.armorBonus.value) back off the Defense's total, noted on its breakdown with the rule's
 * label. `when` sees the actor. Rules sharing a `key` (default: the defense and the items) apply once per actor,
 * however many items carry them - each of a family of items can carry the same rule ("only one Armor Matrix
 * counts").
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

registerRuleType('OnlyBest', {
  params: {
    defense: { kind: 'enum', options: DEFENSES, required: true },
    items: { kind: 'object', required: true },
    path: { kind: 'string' },
    key: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.items) && rule.items.length ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : ['items must be a list of item tags']),
  ],
});

/** What a Defense's breakdown notes: the "- N (label)" the hand-written passes write. */
function takeOff(defense, amount, label) {
  defense.total = (Number(defense.total) || 0) - amount;
  if (typeof defense.string == 'string') {
    defense.string += ` - ${amount} (${label})`;
  }
}

/** The derived pass: for each OnlyBest key, all but the best matching item's bonus come off. */
export function onlyBestDerived(actor) {
  const defenses = actor?.system?.defenses;
  if (!defenses) {
    return;
  }

  const done = new Set();
  for (const { rule, item } of rulesOfType(actor, 'OnlyBest')) {
    const key = rule.key ?? `${rule.defense}:${JSON.stringify(rule.items)}`;
    if (done.has(key) || !defenses[rule.defense] || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    done.add(key);
    const values = itemsOf(actor)
      .filter(other => evaluate(rule.items, contextFor({ self: actor, ruleItem: item, item: other })) === true)
      .map(other => Number(getPath(other, rule.path ?? 'system.armorBonus.value')) || 0)
      .sort((a, b) => b - a);
    const extra = values.slice(1).reduce((sum, value) => sum + value, 0);
    if (extra) {
      takeOff(defenses[rule.defense], extra, ruleLabel(rule, item));
    }
  }
}

registerDerived(onlyBestDerived);
