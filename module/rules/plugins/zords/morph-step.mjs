import { registerStep } from "../../steps.mjs";

/**
 * Step `morph {free?}` (round 15, systems - docs/rules-batches/slSystems15.md): the actor Morphs through the sheet's own
 * Morph flow (sheet-handlers/power-ranger-handler.mjs#onMorph - the Morphed art, Boosted Vigor, the action it costs
 * unless `free`). Already Morphed: nothing happens and the run stops (Rapid Morph's "no-op while Morphed"). Unlike
 * `setForm`, which only writes system.isMorphed.
 */
registerStep('morph', async (step, ctx) => {
  const actor = ctx.actor;
  if (!actor?.system || actor.system.isMorphed) {
    return false;
  }

  const { onMorph } = await import("../../../sheet-handlers/power-ranger-handler.mjs");
  await onMorph(actor, { free: !!step.free });
});

/**
 * Step `refreshMorphedToughness {}` (round 15, systems): the actor's Morphed Toughness bonus is worked out again from the
 * Armor Training it has now (sheet-handlers/perk-handler.mjs#setMorphedToughnessBonus) - the actor is re-prepared first, so
 * in a `removed` Trigger the item going away no longer counts. The Armor Shell Perks, on `added` and `removed`.
 */
registerStep('refreshMorphedToughness', async (step, ctx) => {
  const actor = ctx.actor;
  if (!actor?.system?.trained) {
    return false;
  }

  actor.reset?.();
  const { setMorphedToughnessBonus } = await import("../../../sheet-handlers/perk-handler.mjs");
  await setMorphedToughnessBonus(actor);
});
