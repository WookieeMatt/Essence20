import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md):
 *
 *  - Rule type `CardResistance {}` - the holder has Resistance to the damage of a check card being applied to it, while
 *    `when` holds: the card's damage (and its second damage) is halved, rounded up - Resistance's no-roll form (GI JOE CRB
 *    p.170), since the card's roll is already made. Read by chat.mjs's Apply Damage, after the applyingDamage stages, on
 *    whoever the damage lands on. `when` sees the card (`card:` tags - ctx.card is the message), self: the one hit,
 *    target: the card's speaker. Tough Enough: `["card:flagEquals:isAttack=false", "card:flagEquals:defenseType=toughness"]`.
 *  - Tag `card:flagEquals:<key>=<value>` - the card's flags.essence20.<key> is that value (`true` / `false` are booleans,
 *    anything else is compared as text; an unset flag never equals anything).
 */
registerRuleType('CardResistance', { params: {}, scopes: ['self'] });

registerTag('card:flagEquals', (rest, ctx) => {
  const message = ctx.card;
  const match = /^([\w-]+)=(.*)$/.exec(String(rest ?? ''));
  if (!message || !match) {
    return message ? false : null;
  }

  const value = message.flags?.essence20?.[match[1]];
  if (value === undefined || value === null) {
    return false;
  }

  if (match[2] == 'true' || match[2] == 'false') {
    return value === (match[2] == 'true');
  }

  return String(value) == match[2];
}, { phrase: (arg, w) => {
  const [key, value = ''] = arg.split('=');
  const flag = { isAttack: 'an attack', isMelee: 'melee' }[key];
  if (flag && (value == 'true' || value == 'false')) {
    return value == 'true' ? [`the roll is ${flag}`, `the roll isn't ${flag}`] : [`the roll isn't ${flag}`, `the roll is ${flag}`];
  }

  return [`the roll's ${w.humanize(key).toLowerCase()} is ${w.humanize(value)}`, `the roll's ${w.humanize(key).toLowerCase()} isn't ${w.humanize(value)}`];
} });

/**
 * Whether the card's damage is halved for the one it lands on.
 * @param {Actor} target   Who the damage lands on.
 * @param {ChatMessage} message   The check card.
 * @param {Actor} [attacker]
 * @returns {Boolean}
 */
export function ruleCardResistance(target, message, attacker = null) {
  if (!target || !message) {
    return false;
  }

  return rulesOfType(target, 'CardResistance', 'self').some(({ rule, item }) => evaluate(rule.when, contextFor({ self: target, holder: target, ruleItem: item, other: attacker, card: message })) === true);
}

/** Resistance's no-roll form: half, rounded up. */
export const resisted = damage => (damage > 0 ? Math.ceil(damage / 2) : damage);
