import { registerStep } from "../../steps.mjs";
import { fill } from "./rule-effects.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md): step `shapeSet {set: {key: text}}` - merge those keys into the
 * actor's changed shape for this scene (flags.essence20.mlpShape - items/forms/pony-shape-shifting.mjs#setShape: a shape
 * from an earlier scene is dropped first). Text fills {choice.x} / {var.x} / {item.<path>}. Basic Shape-Shifting and
 * Ponymorph record which spell changed the shape (`spell`), read by their Edge rules.
 */
registerStep('shapeSet', async (step, ctx) => {
  if (!ctx.actor) {
    return false;
  }

  const { setShape, shapeOf } = await import("../../../items/forms/pony-shape-shifting.mjs");
  const values = Object.fromEntries(Object.entries(step.set ?? {}).map(([key, value]) => [key, typeof value == 'string' ? fill(value, ctx) : value]));
  await setShape(ctx.actor, { ...(shapeOf(ctx.actor) ?? {}), ...values });
}, { errors: (step, where) => (step.set && typeof step.set == 'object' && Object.keys(step.set).length ? [] : [`${where}: shapeSet needs set`]) });
