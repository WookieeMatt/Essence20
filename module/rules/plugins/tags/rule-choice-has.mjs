import { registerTag } from "../../predicate.mjs";
import { choiceValue } from "../../choice-read.mjs";

/**
 * Round 16 (part a): tag `rule:choiceHas:<key>:<value>` - the pick the rule's own item keeps under `key`
 * (flags.essence20.rules.choices.<key>) is, or - a list from pickMany / pickEach - holds, that value (Scarefying
 * Appearance's two benefits). No pick, or no rule item: false.
 *
 * Perk choice P2: `rule:choiceHas:<key>` with no value - some pick is made under `key` (Vicious or Venom's "a choice was
 * made"). The pick is read through rules/choice-read.mjs#choiceValue, so an item converted from the old Perk picker
 * (`legacy: "system.choice"`) reads its old pick until the world migration copies it over.
 * `item:choiceHas:<key>[:<value>]` asks the same of the tag's item (Gallantry: a held Fighting Style's pick).
 */
function choiceHas(item, rest) {
  const [key, ...more] = String(rest ?? '').split(':');
  const value = more.join(':');
  const picked = key && item ? choiceValue(item, key) : undefined;
  const entries = (Array.isArray(picked) ? picked : [picked]).filter(entry => entry !== undefined && entry !== null && entry !== '');
  if (!entries.length) {
    return false;
  }

  return !value || entries.map(String).includes(value);
}

const phrase = who => (arg, w) => {
  const [key, ...more] = arg.split(':');
  const value = more.join(':');
  const what = w.humanize(key).toLowerCase();
  return value
    ? [`${who} picked ${w.humanize(value)} for ${what}`, `${who} didn't pick ${w.humanize(value)} for ${what}`]
    : [`${who} made a pick for ${what}`, `${who} haven't picked ${what}`];
};

registerTag('rule:choiceHas', (rest, ctx) => choiceHas(ctx.ruleItem, rest), { phrase: phrase('you') });

registerTag('item:choiceHas', (rest, ctx) => choiceHas(ctx.item, rest), { phrase: phrase('its holder') });
