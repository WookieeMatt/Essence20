import { itemsFor, registerStep } from "../../steps.mjs";

/**
 * Group A (round 10): step `transformInto` {item} - convert into the Alt Mode the item selector finds (`choice:<key>`
 * after a pick).
 */

registerStep('transformInto', async (step, ctx) => {
  const [mode] = itemsFor(step, ctx.actor, ctx).filter(item => item.type == 'altMode');
  if (!mode || typeof ctx.actor?.transform != 'function') {
    return false;
  }

  await ctx.actor.transform(mode.uuid);
  ctx.vars.mode = mode.name;
}, { errors: (step, where) => (step.item ? [] : [`${where}: transformInto needs an item`]) });
