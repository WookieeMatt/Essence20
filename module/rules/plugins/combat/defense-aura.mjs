import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `DefenseAura {defenses, radius, bonus: rolePoints | amount}` (round 15, items1) - the holder lends allies
 * within `radius` feet (same disposition, not itself) a bonus to those Defenses, worked into every per-attack Defense
 * value dice.mjs computes (the compared Defense, and the swapped / "use the better" ones - Over the Candlestick, the early
 * Defense rules), as a value of that Defense rather than one add at the end. `bonus: "rolePoints"` - the holder's base Role
 * Points item's own defense bonus (system.bonus.value) when it covers that Defense (system.bonus.defenseBonus.<defense>);
 * else `amount` (a formula, as the holder). `when` is asked as the holder (other: the ally). Several holders in range: the
 * best one counts (they don't stack). Shield Upgrade (with `check:personalShield`).
 */

registerRuleType('DefenseAura', {
  params: { defenses: { kind: 'strings' }, radius: { kind: 'number' }, bonus: { kind: 'enum', options: ['rolePoints'] }, amount: { kind: 'formula' } },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.defenses) && rule.defenses.length ? [] : ['needs defenses']),
    ...(Number(rule.radius) > 0 ? [] : ['needs a radius (feet)']),
    ...(rule.bonus == 'rolePoints' || rule.amount !== undefined ? [] : ['needs bonus: rolePoints or an amount']),
  ],
});

function bonusOf(rule, holder, defenseType, item) {
  if (rule.bonus == 'rolePoints') {
    const rolePoints = holder._getBaseRolePoints?.();
    return rolePoints?.system?.bonus?.defenseBonus?.[defenseType] ? Number(rolePoints.system.bonus.value) || 0 : 0;
  }

  return Number(resolveValue(rule.amount, { actor: holder, item }, 0)) || 0;
}

/**
 * The best DefenseAura bonus an ally holder near `target` lends to that Defense (0 with none).
 * @param {Actor} target   The actor whose Defense an attack is compared against.
 * @param {String} defenseType
 * @returns {Number}
 */
export function ruleDefenseAura(target, defenseType) {
  const targetToken = target?.getActiveTokens?.()?.[0];
  const canvas = globalThis.canvas;
  if (!targetToken || !canvas?.tokens) {
    return 0;
  }

  let best = 0;
  for (const token of canvas.tokens.placeables ?? []) {
    const holder = token.actor;
    if (token === targetToken || !holder || token.document?.disposition !== targetToken.document?.disposition) {
      continue;
    }

    for (const { rule, item } of rulesOfType(holder, 'DefenseAura')) {
      if (!(rule.defenses ?? []).includes(defenseType)
        || evaluate(rule.when, contextFor({ self: holder, holder, other: target, ruleItem: item })) !== true) {
        continue;
      }

      const amount = bonusOf(rule, holder, defenseType, item);
      if (amount > best && canvas.grid.measurePath([token.center, targetToken.center]).distance <= Number(rule.radius)) {
        best = amount;
      }
    }
  }

  return best;
}
