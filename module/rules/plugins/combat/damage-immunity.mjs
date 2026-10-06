import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md): rule type `DamageImmunity` - while `when` holds, damage of these
 * types does nothing to the holder, read where mechanics/combat/combat.mjs#applyDamage reads system.immunities (so a hit
 * that ignores Immunity - Concentrated Fire's - still lands), and by the Personal Shield's EMP drop
 * (items/defenses/personal-shield-uses.mjs). It is not a sheet Immunity: system.immunities and its readers don't see it.
 *
 *   damageTypes: [types]   those damage types (Impenetrable Shield's EMP while the Personal Shield is up);
 *   choiceOf: <uuid>       the damage type chosen (system.choice) on the actor's first copy of that item (Energy Mastery:
 *                          its Energy Affinity's Element).
 *
 * `when` sees the holder (self:).
 */
registerRuleType('DamageImmunity', {
  params: { damageTypes: { kind: 'strings' }, choiceOf: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => ((Array.isArray(rule.damageTypes) && rule.damageTypes.length) || rule.choiceOf ? [] : ['needs damageTypes or choiceOf']),
});

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);

function covers(rule, actor, damageType) {
  if (Array.isArray(rule.damageTypes) && rule.damageTypes.includes(damageType)) {
    return true;
  }

  return !!rule.choiceOf && itemsOf(actor).find(item => sourceOf(item) == rule.choiceOf)?.system?.choice == damageType;
}

/**
 * Whether the actor's DamageImmunity rules make it immune to this damage type now.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function ruleDamageImmune(actor, damageType) {
  if (!actor || !damageType) {
    return false;
  }

  return rulesOfType(actor, 'DamageImmunity', 'self').some(({ rule, item }) => covers(rule, actor, damageType)
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true);
}
