import { resolveValue } from "../../formula.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `ConditionDuration {condition, rounds}` (round 15, uses) - on an attack (weapon effect) whose damage type is a
 * Condition: how many rounds the on-hit Condition lasts, instead of the generic rider's 1 (mechanics/combat/target-riders.mjs
 * #conditionRiders). `rounds` is a number, a formula, or dice ("1d2" - rolled each hit). Gyro-Gun Alternate Effect.
 * Read off the rolled attack itself, so it works for whoever holds the weapon.
 */

registerRuleType('ConditionDuration', {
  params: { condition: { kind: 'string', required: true }, rounds: { kind: 'string', required: true } },
  scopes: ['self'],
});

/** The rounds the attack's own ConditionDuration rule gives that Condition, or `fallback` with none. */
export async function ruleConditionRounds(item, condition, fallback = 1) {
  const rule = (Array.isArray(item?.system?.rules) ? item.system.rules : [])
    .find(one => one?.type == 'ConditionDuration' && one.condition == condition);
  if (!rule) {
    return fallback;
  }

  const text = String(rule.rounds ?? '').trim();
  if (/^\d*d\d+/i.test(text) && globalThis.Roll) {
    const roll = await new globalThis.Roll(text).evaluate();
    return Math.max(1, Math.round(Number(roll.total) || fallback));
  }

  const value = resolveValue(text, { actor: item?.parent ?? null, item }, fallback);
  return Math.max(1, Math.round(Number(value) || fallback));
}
