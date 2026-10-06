import { legacyValue } from "../../legacy-choices.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { runSteps, stepContext } from "../../steps.mjs";
import { itemsOf, localize, say, sourceOf } from "./common.mjs";

/**
 * DialogSelect extras (round 11, group G) - the pure helpers rules/ext/c/dialog.mjs asks while it builds and applies a
 * DialogSelect. No side effects on import (dialog.mjs imports this file before it registers DialogSelect; the rule
 * type's new params are added by ./select-rule.mjs).
 *
 *   options[i].when: [tags]    the option is offered only while the tags hold (asked as the select itself is: self:
 *                              the roller, holder:, item: the rolled item, target:)
 *   options[i].pay: [steps]    run (as the holder) when the option is chosen, before it applies; a stopped run (an
 *                              action that can't be spent) means the option doesn't apply at all - as if the first
 *                              option were chosen
 *   optionsFrom: {picked, legacy?, copies?, labels?, label?, key?, pay?, steps?}
 *                              one more option per value a pick stored on the rule's item under `picked` (a list -
 *                              pickEach / pickMany - or one value); `legacy` - where an older version kept it;
 *                              `copies: true` - the values the actor's other copies of the same book item hold too;
 *                              `labels: "damageType"` labels them with CONFIG.E20.damageTypes; `label` / `key` fill
 *                              {value} and {label}; `pay` / `steps` as an option's
 *
 * A select left with fewer than two options isn't shown. Values are stable: an authored option is its index ("0"),
 * a generated one "v:<value>".
 */

// As the hand-written selects labelled them: game.i18n.localize of the CONFIG label.
const damageTypeLabel = value => {
  const key = globalThis.CONFIG?.E20?.damageTypes?.[value] ?? value;
  return globalThis.game?.i18n?.localize?.(key) ?? key;
};

function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined || value === null || value === '' ? [] : [value];
}

/** The values a pick stored on an item under `key` (its old `legacy` path when there's none yet). */
export function storedPick(item, key, legacy = null) {
  const stored = item?.flags?.essence20?.rules?.choices?.[key];
  const value = stored === undefined || stored === null || (Array.isArray(stored) && !stored.length) ? legacyValue(legacy, item) : stored;
  return asList(value);
}

/** The values for optionsFrom: this item's pick, and (copies) its other copies' on the same actor, in item order. */
export function pickedValues(item, spec, actor = item?.parent) {
  const source = sourceOf(item);
  const items = spec?.copies && source ? itemsOf(actor).filter(other => other === item || sourceOf(other) == source) : [item];
  if (!items.includes(item)) {
    items.unshift(item);
  }

  return [...new Set(items.flatMap(other => storedPick(other, spec?.picked, spec?.legacy)))];
}

/** Every option a DialogSelect entry offers now: [{value, label, option}]. */
export function selectChoices(entry) {
  const { rule, item, holder } = entry ?? {};
  const ask = entry?.ask ?? { self: holder, holder, ruleItem: item };
  const out = [];
  (Array.isArray(rule?.options) ? rule.options : []).forEach((option, i) => {
    if (!Array.isArray(option?.when) || !option.when.length || evaluate(option.when, contextFor(ask)) === true) {
      out.push({ value: String(i), label: option?.label ?? '', option });
    }
  });

  const from = rule?.optionsFrom;
  if (from?.picked) {
    for (const value of pickedValues(item, from, holder ?? item?.parent)) {
      const shown = from.labels == 'damageType' ? damageTypeLabel(value) : String(value);
      const fill = text => String(text).replace(/\{value\}/g, value).replace(/\{label\}/g, shown);
      const label = from.label ? fill(localize(from.label)) : shown;
      out.push({
        value: `v:${value}`, label,
        option: { label, ...(from.key ? { key: fill(from.key) } : {}), ...(from.pay ? { pay: from.pay } : {}), ...(from.steps ? { steps: from.steps } : {}) },
      });
    }
  }

  return out;
}

/** The option a select's value names now, or null. */
export function selectOption(entry, value) {
  return selectChoices(entry).find(choice => choice.value == String(value))?.option ?? null;
}

/** Run an option's `pay` steps as the select's holder. Resolves false when they stopped. */
export async function payOption(option, entry) {
  if (!Array.isArray(option?.pay) || !option.pay.length) {
    return true;
  }

  const ctx = stepContext({ actor: entry.holder, item: entry.item, rule: entry.rule, targets: [] });
  const finished = await runSteps(option.pay, ctx);
  if (ctx.chat.length) {
    await say(entry.holder, ctx.chat.join('<br>'));
  }

  return finished !== false;
}

/**
 * {switch.<prefix>} in a text - the rest of the first ticked switch key "<prefix>:<value>" (a generated DialogSelect
 * option's key), else nothing. HitRider's option damageType reads the chosen type this way.
 */
export function fillSwitch(text, switches = []) {
  return String(text ?? '').replace(/\{switch\.([\w-]+)\}/g, (match, prefix) => {
    const found = (Array.isArray(switches) ? switches : []).find(key => String(key).startsWith(`${prefix}:`));
    return found ? String(found).slice(prefix.length + 1) : '';
  });
}
