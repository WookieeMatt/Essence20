// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): the `posted` event and the
// placeRoughTerrain step. Registered on import; see module/rules/plugins/index.mjs. Import-light: documents/item.mjs
// loads it directly (the trigger engine and the terrain code are imported lazily).
import { rulesOf } from "../../index.mjs";
import { registerStep } from "../../steps.mjs";
import { registerEvent } from "../../types.mjs";

/**
 * Event `posted` - an item was posted to chat from its sheet (documents/item.mjs, the gear / plain-item branch - for gear
 * whose only sheet action that is). Only the item's own rules are asked: `when: ["item:own"]`.
 */
registerEvent('posted');

/**
 * Fire the posted item's own `posted` Triggers.
 * @param {Actor} actor
 * @param {Item} item
 */
export async function firePosted(actor, item) {
  if (!actor || !rulesOf(item).some(rule => rule?.type == 'Trigger' && rule.event == 'posted' && !rule.disabled)) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'posted', { roll: { item } });
}

/**
 * Step `placeRoughTerrain {prompt?, chat?}` - asks (`prompt`, an E20. key or text) and lets the player place one grid
 * space of Rough Terrain on the viewed scene, made through the GM (mechanics/world/rough-terrain.mjs#placeRoughTerrainSpace);
 * `chat` (an E20. key or text with {name} and {item}) announces it. A declined or cancelled placement stops the run.
 * Piledriver: a `posted` Trigger in Alt Mode.
 */
registerStep('placeRoughTerrain', async (step, ctx) => {
  const { placeRoughTerrainSpace } = await import("../../../mechanics/world/rough-terrain.mjs");
  const placed = await placeRoughTerrainSpace(ctx.actor, ctx.item, { prompt: step.prompt, chat: step.chat });
  return placed ? undefined : false;
});
