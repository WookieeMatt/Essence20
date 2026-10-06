import { registerTag } from "../../predicate.mjs";

/**
 * Round 16 (part a): tag `rule:choiceHas:<key>:<value>` - the pick the rule's own item keeps under `key`
 * (flags.essence20.rules.choices.<key>) is, or - a list from pickMany / pickEach - holds, that value (Scarefying
 * Appearance's two benefits). No pick, or no rule item: false.
 */
registerTag('rule:choiceHas', (rest, ctx) => {
  const [key, ...more] = String(rest ?? '').split(':');
  const value = more.join(':');
  const picked = ctx.ruleItem?.flags?.essence20?.rules?.choices?.[key];
  if (!key || !value || picked === undefined || picked === null) {
    return false;
  }

  return Array.isArray(picked) ? picked.map(String).includes(value) : String(picked) == value;
}, { phrase: (arg, w) => {
  const [key, ...more] = arg.split(':');
  return [`you picked ${w.humanize(more.join(':'))} for ${w.humanize(key).toLowerCase()}`, `you didn't pick ${w.humanize(more.join(':'))} for ${w.humanize(key).toLowerCase()}`];
} });
