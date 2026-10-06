import { formulaError, resolveValue } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { pickOptions, registerStep } from "../../steps.mjs";
import { storedPick } from "../dialog/dialog-select-options.mjs";
import { itemsOf, localize, sourceOf, write } from "../shared/card-text-helpers.mjs";

/**
 * pickEach {key, count, from, only?, excludeCopies?, prompt?, legacy?, ...that source's options} (round 11, group G) -
 * choose `count` different values one at a time (a select each time, `prompt` filling {n} with the pick's number),
 * kept on the rule's item as a list under `key`. Every pick leaves out the ones before it; `excludeCopies` also
 * leaves out what the actor's other copies of the same book item hold under the key ("can be acquired multiple times,
 * adding new types"); `only` narrows the source to those values. Running out of values ends early and keeps what was
 * chosen; cancelling any pick stops the run and keeps nothing. @var.picked is the list, @var.pickedLabels its labels
 * joined with ", ". Give it `record: true` with `legacy` so the start-up linking pass moves an old pick too.
 *
 * Tag rule:firstCopy - the rule's item is the first copy of its book item on the actor (an item read once per actor
 * however many copies there are, when the copies' picks differ).
 */

async function askPick(step, options, ctx, n) {
  if (ctx.askPick) {
    return ctx.askPick({ ...step, n }, options, ctx);
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  const prompt = localize(step.prompt ?? '').replace(/\{n\}/g, String(n));
  return chooseSelect(ctx.item?.name ?? '', prompt, options);
}

/** What the actor's other copies of this book item hold under `key`. */
export function copiesHold(item, key, legacy = null) {
  const source = sourceOf(item);
  return source ? itemsOf(item?.parent).filter(other => other !== item && other.id != item.id && sourceOf(other) == source).flatMap(other => storedPick(other, key, legacy)) : [];
}

registerStep('pickEach', async (step, ctx) => {
  const key = String(step.key ?? '');
  if (!key || !ctx.item) {
    return false;
  }

  const only = Array.isArray(step.only) && step.only.length ? step.only.map(String) : null;
  const all = pickOptions(step, ctx).filter(option => !only || only.includes(String(option.value)));
  const taken = new Set(step.excludeCopies ? copiesHold(ctx.item, key, step.legacy) : []);
  const count = Math.max(0, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  const picks = [];
  for (let n = 1; n <= count; n++) {
    const options = all.filter(option => !taken.has(option.value) && !picks.includes(option.value));
    if (!options.length) {
      break;
    }

    const value = await askPick(step, options, ctx, n);
    const chosen = options.find(option => option.value == value);
    if (!chosen) {
      return false;
    }

    picks.push(chosen.value);
  }

  await write(ctx.item, 'update', [{ [`flags.essence20.rules.choices.${key}`]: picks }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.item, `flags.essence20.rules.choices.${key}`, picks);
  ctx.vars.picked = picks;
  ctx.vars.pickedLabels = picks.map(value => all.find(option => option.value == value)?.label ?? value).join(', ');
}, {
  errors: (step, where) => [
    ...(step.key && step.from ? [] : [`${where}: pickEach needs a key and from`]),
    ...(formulaError(step.count) ? [`${where}.count: ${formulaError(step.count)}`] : []),
    ...(step.only !== undefined && !Array.isArray(step.only) ? [`${where}: only must be a list`] : []),
  ],
});

registerTag('rule:firstCopy', (rest, ctx) => {
  const item = ctx.ruleItem;
  const source = sourceOf(item);
  if (!item || !source) {
    return !!item;
  }

  const first = itemsOf(item.parent ?? ctx.self).find(other => sourceOf(other) == source);
  return !first || first === item || (!!first.id && first.id == item.id);
}, { phrase: ['this is your first copy of the item', "this isn't your first copy of the item"] });
