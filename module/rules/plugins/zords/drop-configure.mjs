// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): the drop-time configurator pieces.
// Registered on import; see module/rules/plugins/index.mjs.
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Items that configure something as they are taken ("choose one of the Zord's attacks ...") are an `added` Trigger on
 * the item - it runs once the item is on the actor:
 *
 * - Trigger `removeOnStop: true` (event added only - rules/triggers.mjs#fireItemAdded): a stopped run (a cancelled pick,
 *   nothing to pick, a `required` step that finds nothing) deletes the item again, as a cancelled drop never added it.
 * - Step `adjustItem {item, onParent?, add?, multiply?, atLeast?, set?, defaults?, addTraits?, required?, message?, to?}` -
 *   changes the items an item selector finds (`choice:<key>` after a `pick from: ownedItem`), reading each one's own
 *   values: `add` (formulas), then `multiply`, then `atLeast` ({path: number} each - the value is raised to at least it),
 *   then `set` (numbers / formulas, or text such as a shape). A missing value counts as `defaults[path]` (0 by default;
 *   for `multiply` a 0 counts as the default too). `addTraits` adds those to system.traits when missing. `onParent`:
 *   change the found item's parent weapon instead (a weapon effect's flags.essence20.parentId). With `required`, finding
 *   nothing stops the run and `message` (an E20. key or text) is a warning toast. `{var.adjustedName}`: the last item
 *   changed; `{var.adjustedItemName}`: the item the selector found (the attack, when onParent changed its weapon). Text
 *   `set` values fill {var.x} / {choice.x}.
 * - Step `notify {text, data?, level?: info | warn, stop?}` - a toast: `text` an E20. key (formatted with `data`, whose
 *   texts fill {var.x} / {choice.x} / {name}, an E20. key localized) or plain text; `stop: true` then stops the run.
 * - Tag `self:hasItemWhere:<item tags joined by &>` - one of the actor's items meets all of them (asked as the item).
 */
if (RULE_TYPES.Trigger?.params && !RULE_TYPES.Trigger.params.removeOnStop) {
  RULE_TYPES.Trigger.params.removeOnStop = { kind: 'bool' };
}

const getPath = (object, path) => String(path ?? '').split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), object);

/** {var.x}, {choice.x} (the rule's item's picks) and {name} in a text. */
export function fillDropText(text, ctx) {
  const choices = ctx.item?.flags?.essence20?.rules?.choices ?? {};
  return String(text ?? '')
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{choice\.([\w-]+)\}/g, (match, key) => String(choices[key] ?? ''))
    .replace(/\{name\}/g, ctx.actor?.name ?? '');
}

function toast(text, data, level, ctx) {
  const i18n = globalThis.game?.i18n;
  const filled = Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => {
    const raw = fillDropText(value, ctx);
    return [key, /^E20\./.test(raw) && i18n?.localize ? i18n.localize(raw) : raw];
  }));
  const key = String(text ?? '');
  const message = /^E20\./.test(key) && i18n ? (Object.keys(filled).length ? i18n.format(key, filled) : i18n.localize(key)) : fillDropText(key, ctx);
  globalThis.ui?.notifications?.[level == 'warn' ? 'warn' : 'info']?.(message);
}

registerStep('notify', async (step, ctx) => {
  toast(step.text, step.data, step.level, ctx);
  return step.stop ? false : undefined;
}, { errors: (step, where) => (step.text ? [] : [`${where}: notify needs a text`]) });

registerStep('adjustItem', async (step, ctx) => {
  const { itemsFor, recipients } = await import("../../steps.mjs");
  const { resolveValue } = await import("../../formula.mjs");
  const defaults = step.defaults ?? {};
  let changed = 0;
  for (const actor of step.to ? recipients(step, ctx) : [ctx.actor]) {
    for (const found of itemsFor(step, actor, ctx)) {
      const target = step.onParent ? actor?.items?.get?.(found.flags?.essence20?.parentId) ?? null : found;
      if (!target) {
        continue;
      }

      const update = {};
      const current = (path, forMultiply = false) => {
        const value = Number(path in update ? update[path] : getPath(target, path));
        const fallback = Number(defaults[path] ?? (forMultiply ? 1 : 0));
        return !Number.isFinite(value) || (forMultiply && !value) ? fallback : value;
      };

      for (const [path, formula] of Object.entries(step.add ?? {})) {
        update[path] = current(path) + (Number(resolveValue(formula, { actor, item: ctx.item, vars: ctx.vars }, 0)) || 0);
      }

      for (const [path, factor] of Object.entries(step.multiply ?? {})) {
        update[path] = current(path, true) * (Number(factor) || 1);
      }

      for (const [path, floor] of Object.entries(step.atLeast ?? {})) {
        update[path] = Math.max(Number(floor) || 0, current(path));
      }

      for (const [path, value] of Object.entries(step.set ?? {})) {
        update[path] = typeof value == 'number' || /^[\d@(]/.test(String(value)) ? Number(resolveValue(value, { actor, item: ctx.item, vars: ctx.vars }, 0))
          : typeof value == 'string' ? fillDropText(value, ctx) : value;
      }

      const traits = [step.addTraits ?? []].flat().filter(Boolean);
      if (traits.length) {
        const own = Array.isArray(target.system?.traits) ? target.system.traits : [];
        const missing = traits.filter(trait => !own.includes(trait));
        if (missing.length) {
          update['system.traits'] = [...own, ...missing];
        }
      }

      if (Object.keys(update).length) {
        const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
        await (needsGmRelay(target) ? relayToGm(target, 'update', [update]) : target.update(update));
      }

      ctx.vars.adjustedName = target.name ?? '';
      ctx.vars.adjustedItemName = found.name ?? '';
      changed += 1;
    }
  }

  if (!changed && step.required) {
    if (step.message) {
      toast(step.message, null, 'warn', ctx);
    }

    return false;
  }
}, {
  errors: (step, where) => (step.item ? [] : [`${where}: adjustItem needs an item selector`]),
});

registerTag('self:hasItemWhere', (rest, ctx) => {
  const tags = String(rest ?? '').split('&').filter(Boolean);
  const items = ctx?.self?.items?.contents ?? (ctx?.self?.items ? [...ctx.self.items] : []);
  return !!tags.length && items.some(item => evaluate(tags, contextFor({ self: ctx.self, ruleItem: ctx.ruleItem, item })) === true);
}, { phrase: (arg, w) => [`{who} {has} an item where ${w.items(arg.split('&'))}`, `{who} {has} no item where ${w.items(arg.split('&'))}`] });
