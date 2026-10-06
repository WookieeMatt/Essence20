import { registerRuleType } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";

/**
 * `BrawnRequirement` {amount?, ignore?, carrying?, stack?} (round 10, group C) - the actor's Brawn counts `amount`
 * die sizes higher against equipment's Brawn requirement (items/defenses/armor-brawn-reinforced-shell.mjs
 * #brawnRequirementBonus), or the requirement is ignored outright. `carrying: true` also raises it for carrying
 * capacity (mechanics/resources/kits.mjs#carryPercent). Rules sharing a `stack` group count once (the biggest). Over Brawn,
 * The Heavy, Pack Mule.
 *
 * Kept apart from the other plug-ins (and light on imports): kits.mjs and armor-rules.mjs read it.
 */

registerRuleType('BrawnRequirement', {
  params: { amount: { kind: 'formula' }, ignore: { kind: 'bool' }, carrying: { kind: 'bool' }, stack: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => (rule.amount !== undefined || rule.ignore ? [] : ['give an amount or ignore']),
});

/**
 * How many die sizes higher the actor's Brawn counts - Infinity when a rule ignores the requirement.
 * @param {Actor} actor
 * @param {'requirement'|'carrying'} use
 * @returns {Number}
 */
export function ruleBrawnBonus(actor, use = 'requirement') {
  const live = rulesOfType(actor, 'BrawnRequirement', 'self')
    .filter(({ rule }) => use != 'carrying' || rule.carrying)
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, combat: null })) === true);
  if (use == 'requirement' && live.some(({ rule }) => rule.ignore)) {
    return Infinity;
  }

  const best = new Map();
  let total = 0;
  for (const entry of live.filter(({ rule }) => !rule.ignore)) {
    const amount = Math.round(resolveValue(entry.rule.amount ?? 0, { actor, item: entry.item }, 0));
    if (!entry.rule.stack) {
      total += amount;
    } else if (!best.has(entry.rule.stack) || amount > best.get(entry.rule.stack)) {
      best.set(entry.rule.stack, amount);
    }
  }

  return total + [...best.values()].reduce((sum, amount) => sum + amount, 0);
}
