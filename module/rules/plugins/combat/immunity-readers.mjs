import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule types read by hand-written code (round 10, group B). Each is a plain "the holder has this" fact, with `when`:
 *
 *   MissImmunity {}          a miss against the holder has no effect at all - no Frightened, no aftershock, no Rough
 *                            Terrain (dice.mjs, rough-terrain.mjs through gij3/dice-hooks.mjs#ignoresMissEffects);
 *                            `when` sees defense:<the Defense the attack was against>
 *   SneakAttackImmunity {}   the holder never takes sneak attack damage (mechanics/combat/sneak-attack.mjs)
 *   CrashProtection {}       the vehicle this holder pilots protects its crew while it's Defeated: a crash deals
 *                            them nothing, an explosion at most 1 (items/vehicles/roll-cage.mjs)
 *   HideBonus {amount}       a roll declared as the Hide action adds `amount` to its result (helpers/extensions/
 *                            other3/hide.mjs - the Hide switch); `when` sees the roll
 */

registerRuleType('MissImmunity', { params: {}, scopes: ['self'] });
registerRuleType('SneakAttackImmunity', { params: {}, scopes: ['self'] });
registerRuleType('CrashProtection', { params: {}, scopes: ['self'] });
registerRuleType('HideBonus', { params: { amount: { kind: 'formula', required: true } }, scopes: ['self'] });

/** The first item whose rule of this type holds for the actor, or null. */
function holdingItem(actor, type, facts = {}) {
  if (!actor) {
    return null;
  }

  const found = rulesOfType(actor, type).find(({ rule, item }) => evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem: item })) === true);
  return found?.item ?? null;
}

export function ruleIgnoresMissEffects(actor, defenseType) {
  return !!holdingItem(actor, 'MissImmunity', { defenseType });
}

export function ruleSneakAttackImmune(actor) {
  return !!holdingItem(actor, 'SneakAttackImmunity');
}

/** The pilot's item that protects the crew (its name goes on the chat line), or null. */
export function crashProtectionOf(pilot) {
  return holdingItem(pilot, 'CrashProtection');
}

/** What the actor's HideBonus rules add to a Hide roll (the roll facts: rolledSkill, item...). */
export function ruleHideBonus(actor, facts = {}) {
  let total = 0;
  for (const { rule, item } of actor ? rulesOfType(actor, 'HideBonus') : []) {
    if (evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem: item })) === true) {
      total += Math.round(resolveValue(rule.amount, { actor, item }, 0));
    }
  }

  return total;
}
