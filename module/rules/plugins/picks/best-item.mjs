import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { itemsOf, localize } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - copying from the actor's own strongest item (Elemental Fury's "two times the damage of this
 * Zord's strongest ranged Attack, uses its Range"):
 *
 *   step bestItem {type, where?, by, keep, var?, message?}
 *       Among the actor's items of `type` whose `where` tags hold (item: = the candidate, self: = the actor), the one
 *       with the highest number at `by`. Kept as @var.<var> (default best: its id); `keep: {<var>: <path>}` copies its
 *       values into the run (objects too - a createItem field that is only "{var.<var>}" takes the value as it is).
 *       None: `message` (an E20. key; {name} the actor) as a warning, and the run stops.
 *   tag roll:crit - the roll is a Critical Success (a hit's facts: HitRider rules on a weapon hit).
 */

const read = (doc, path) => String(path ?? '').split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), doc);
const clone = value => (value && typeof value == 'object' ? JSON.parse(JSON.stringify(value)) : value);

registerTag('roll:crit', (rest, ctx) => (ctx?.isCrit === undefined ? null : !!ctx.isCrit));

registerStep('bestItem', async (step, ctx) => {
  const candidates = itemsOf(ctx.actor).filter(item => (!step.type || item.type == step.type)
    && (!Array.isArray(step.where) || evaluate(step.where, contextFor({ self: ctx.actor, item, ruleItem: ctx.item })) === true));
  const best = candidates.sort((a, b) => (Number(read(b, step.by)) || 0) - (Number(read(a, step.by)) || 0))[0] ?? null;
  if (!best) {
    if (step.message) {
      const text = localize(step.message, { name: ctx.actor?.name ?? '' });
      globalThis.ui?.notifications?.warn?.(String(text).replace(/\{name\}/g, ctx.actor?.name ?? ''));
    }

    return false;
  }

  ctx.vars[step.var || 'best'] = best.id;
  for (const [name, path] of Object.entries(step.keep ?? {})) {
    ctx.vars[name] = clone(read(best, path)) ?? '';
  }
}, {
  errors: (step, where) => [
    ...(step.by ? [] : [`${where}: bestItem needs by (the path compared)`]),
    ...(step.keep === undefined || (step.keep && typeof step.keep == 'object' && Object.keys(step.keep).every(key => /^[\w-]+$/.test(key))) ? [] : [`${where}: keep must map plain names to paths`]),
  ],
});
