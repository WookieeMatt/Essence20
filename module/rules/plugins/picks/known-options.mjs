import { ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerRuleType } from "../../types.mjs";
import { write } from "../shared/zord-crew-lookups.mjs";

/**
 * Group A (round 10): rule type `KnownOptions` {key, count, options, prompt?}: the options a helper may offer are only
 * the ones the holder noted - as many as `count` (a formula), asked for when fewer are noted (Emotional Range's
 * Emotional Mastery options; items/resources/emotional-mastery.mjs asks ensureKnownOptions). `legacy`: an actor flag
 * holding an older list.
 */

registerRuleType('KnownOptions', {
  params: {
    key: { kind: 'string', required: true }, count: { kind: 'formula', required: true }, options: { kind: 'strings', required: true },
    labels: { kind: 'string' }, prompt: { kind: 'string' }, title: { kind: 'string' }, legacy: { kind: 'string' },
  },
  scopes: ['self'],
});

/**
 * The options the actor may use from a KnownOptions list, topped up (by asking) to the rule's count first. null when
 * no rule limits the list (every option is offered).
 * @param {Actor} actor
 * @param {String} key
 * @returns {Promise<String[]|null>}
 */
export async function ensureKnownOptions(actor, key, { choose = null } = {}) {
  const entry = rulesOfType(actor, 'KnownOptions').find(({ rule, item }) => rule.key == key
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
  if (!entry) {
    return null;
  }

  const { rule, item } = entry;
  const count = Math.round(resolveValue(rule.count, { actor, item }, 0));
  if (!(count > 0)) {
    return null;
  }

  const stored = item.flags?.essence20?.rules?.choices?.[`known-${key}`];
  const legacy = rule.legacy ? actor.flags?.essence20?.[rule.legacy] : null;
  const known = (Array.isArray(stored) ? stored : Array.isArray(legacy) ? legacy : []).filter(option => rule.options.includes(option)).slice(0, count);
  if (known.length < count) {
    const localize = text => globalThis.game?.i18n?.localize?.(text) ?? text;
    const ask = choose ?? (async (title, prompt, options) => (await import("../../../mechanics/resources/grants.mjs")).chooseSelect(title, prompt, options));
    while (known.length < count) {
      const left = rule.options.filter(option => !known.includes(option));
      const label = option => localize(String(rule.labels ?? '{option}').replace('{Option}', option.charAt(0).toUpperCase() + option.slice(1)).replace('{option}', option));
      const picked = await ask(rule.title ?? ruleLabel(rule, item), String(rule.prompt ?? '').replace('{n}', known.length + 1).replace('{count}', count),
        left.map(value => ({ value, label: label(value) })));
      if (!picked) {
        break;
      }

      known.push(picked);
    }

    await write(item, 'update', [{ [`flags.essence20.rules.choices.known-${key}`]: known }]);
  }

  return known.length ? known : null;
}
