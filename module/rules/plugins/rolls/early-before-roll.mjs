// Rules-engine plug-ins, round 14 (items1): BeforeRoll `early: true`. Registered on import; see
// module/rules/plugins/index.mjs and docs/rules-batches/slItems114.md.
import { RULE_TYPES } from "../../types.mjs";
import { rulesOf, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { firstTarget, targetedActors } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * BeforeRoll `{cancel: true, early: true}` - the refusal is checked when the item is used (documents/item.mjs#roll),
 * before its action is paid for good, its Area of Effect is placed or any pre-roll picker opens: a refused use gets its
 * action back (the once-per-encounter weapon effects - Turbo Thunder Cannon / Turbo Lightning Sword's Energy Attack, Wing
 * Missile Salvo). Without `early` a cancel happens inside the roll (the extensions' preRoll), after all of that. The
 * same rule is asked again there, so a roll that doesn't come through item.roll is still refused.
 */

const BEFORE_ROLL = RULE_TYPES.BeforeRoll;
if (BEFORE_ROLL && !BEFORE_ROLL.params.early) {
  BEFORE_ROLL.params.early = { kind: 'bool' };
}

const localize = text => {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  return /^E20\./.test(value) && i18n?.has?.(value) ? i18n.localize(value) : value;
};

/**
 * The early BeforeRoll refusal for using `item` (the roller's own `self` rules and the item's own `item` rules), or
 * null. Warns with the rule's message when there is one.
 * @param {Actor} actor   Who rolls.
 * @param {Item} item     The item being used.
 * @param {Object} [dataset]
 * @returns {?String}   The refusal's message.
 */
export function earlyRollRefusal(actor, item, dataset = {}) {
  if (!actor || !item) {
    return null;
  }

  const onItem = rulesOf(item).map((rule, index) => ({ rule, index, item }))
    .filter(({ rule }) => rule?.type == 'BeforeRoll' && rule.scope == 'item' && !rule.disabled);
  const own = rulesOfType(actor, 'BeforeRoll', 'self');
  for (const { rule, item: ruleItem } of [...own, ...onItem]) {
    if (!rule.early || !rule.cancel) {
      continue;
    }

    const isAttack = item.type == 'weaponEffect';
    const ctx = contextFor({
      item, isAttack, isMelee: isAttack && item.system?.classification?.style == 'melee', rolledSkill: dataset?.skill, dataset,
      self: actor, ruleItem, other: firstTarget(), targetCount: targetedActors().length,
    });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    const message = localize(rule.message ?? '').replace(/\{name\}/g, ruleItem?.name ?? '');
    if (message) {
      globalThis.ui?.notifications?.warn?.(message);
    }

    return message || ruleItem?.name || '';
  }

  return null;
}
