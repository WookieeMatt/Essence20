// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): AttackTraits.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: dice.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `AttackTraits {traits: [armorPiercing | antiTank]}` - the holder's attacks matching `when` (`item:` = the rolled weapon
 * effect, which may have no weapon at all - an Alt Mode's Ram / Flyby attack) count as having those traits where
 * dice.mjs reads them against the target's Toughness: Armor Piercing (deflective armor ignored) and Anti-Tank (plating
 * ignored). For weapon traits on a weapon, use WeaponTrait. Ram Cone: Alt Mode Flyby / Ram / Slam / Bash attacks.
 */
export const ATTACK_TRAITS = ['armorPiercing', 'antiTank'];

registerRuleType('AttackTraits', {
  params: { traits: { kind: 'strings', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.traits) && rule.traits.length && rule.traits.every(trait => ATTACK_TRAITS.includes(trait))
    ? [] : [`traits must list some of ${ATTACK_TRAITS.join(', ')}`]),
});

/**
 * Whether one of the actor's AttackTraits rules gives this attack that trait.
 * @param {Actor} actor
 * @param {Item} item   The rolled weapon effect.
 * @param {String} trait
 * @returns {Boolean}
 */
export function ruleAttackHasTrait(actor, item, trait) {
  if (!actor || !item) {
    return false;
  }

  return rulesOfType(actor, 'AttackTraits').some(({ rule, item: ruleItem }) => (rule.traits ?? []).includes(trait)
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem, item, isAttack: item.type == 'weaponEffect' })) === true);
}
