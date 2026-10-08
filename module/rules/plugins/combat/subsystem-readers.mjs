import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md): rule types read by hand-written subsystems, each a plain "the
 * holder has this" fact with `when` (self: the holder):
 *
 *   AddictionSnag {}                Dark Energon's addiction attacks against the holder suffer Snag
 *                                   (items/resources/dark-energon-addiction-attack.mjs) - Word of Unicron.
 *   CarryCapacity {multiply}        what the holder can carry is multiplied (mechanics/resources/kits.mjs#carryPercent,
 *                                   after the Brawn rank's share; several multiply together) - Growth Boost while Morphed.
 *   ForcedMovementChoice {}         the holder may choose not to be moved by forced movement - asked of whoever moves it,
 *                                   staying put the default (mechanics/combat/forced-movement.mjs#resistsForcedMovement) -
 *                                   Immovable Object.
 *   SkillImmunityOverride {cost}    a hit with a Skill the target is immune to may still affect it if the holder pays
 *                                   `cost` ({storyPoints: N}) - asked per such target (mechanics/combat/target-riders.mjs
 *                                   skill immunity) - Fear Is Universal.
 *   BonusEnergon {}                 the item gives one Energon Point above the maximum that, once spent, can't come back:
 *                                   it counts toward the cap and rides on top through Rests until the item is marked spent
 *                                   (items/resources/repair-progress-bonus-energon.mjs) - Repair Progress: Bonus Energon Point.
 *   CureNote {text}                 a line added to the Heal action's chat card when the holder cures an ally's poison or
 *                                   disease (mechanics/actions/heal-action.mjs; an E20. key or text) - Proper Protection.
 */
registerRuleType('AddictionSnag', { params: {}, scopes: ['self'] });
registerRuleType('CarryCapacity', {
  params: { multiply: { kind: 'formula', required: true } },
  scopes: ['self'],
});
registerRuleType('ForcedMovementChoice', { params: {}, scopes: ['self'] });
registerRuleType('BonusEnergon', { params: {}, scopes: ['self'] });
registerRuleType('CureNote', {
  params: { text: { kind: 'string', required: true } },
  scopes: ['self'],
});

registerRuleType('SkillImmunityOverride', {
  params: { cost: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => (Number(rule.cost?.storyPoints) > 0 ? [] : ['cost needs storyPoints (a number above 0)']),
});

/** The holder's rules of that type whose `when` holds, in order. */
function holding(actor, type, facts = {}) {
  if (!actor) {
    return [];
  }

  return rulesOfType(actor, type, 'self').filter(({ rule, item }) => evaluate(rule.when, contextFor({ ...facts, self: actor, holder: actor, ruleItem: item })) === true);
}

export function ruleAddictionSnag(actor) {
  return holding(actor, 'AddictionSnag').length > 0;
}

/** The product of the holder's CarryCapacity multipliers (1 with none). */
export function ruleCarryMultiplier(actor) {
  return holding(actor, 'CarryCapacity').reduce((total, { rule, item }) => total * (Number(resolveValue(rule.multiply, { actor, item }, 1)) || 1), 1);
}

/** The item giving the holder the choice to stay put, or null. */
export function forcedMovementChoiceOf(actor) {
  return holding(actor, 'ForcedMovementChoice')[0]?.item ?? null;
}

/**
 * The first rule letting the holder affect a creature immune to the rolled Skill: {item, storyPoints}, or null.
 * @param {Actor} actor
 * @param {Actor} [target]
 */
export function skillImmunityOverrideOf(actor, target = null) {
  const found = holding(actor, 'SkillImmunityOverride', { other: target })[0];
  return found ? { item: found.item, storyPoints: Number(found.rule.cost?.storyPoints) || 1 } : null;
}

/** The holder's CureNote lines (localized), joined by spaces - '' with none. */
export function ruleCureNotes(actor) {
  const localize = key => (/^E20\./.test(String(key ?? '')) ? globalThis.game?.i18n?.localize?.(key) ?? key : String(key ?? ''));
  return holding(actor, 'CureNote').map(({ rule }) => localize(rule.text)).filter(Boolean).join(' ');
}

/** The items whose BonusEnergon rule holds for the actor (one bonus point each until spent). */
export function bonusEnergonItems(actor) {
  return [...new Set(holding(actor, 'BonusEnergon').map(({ item }) => item))];
}
