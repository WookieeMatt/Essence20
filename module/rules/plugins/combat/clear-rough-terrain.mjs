import { registerChatButton } from "../../../mechanics/item-hooks.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Round 17 (split2 - docs/rules-batches/slSplit217.md): step `clearRoughTerrain {}` - the Rough Terrain square under the
 * actor's token goes: a Rough Terrain Region (Environment Behavior with roughTerrain on) whose rectangles cover no more
 * than one grid square and hold the token's centre (Wrecker / Piledriver make exactly those); a bigger one is left to the
 * GM. A GM's client clears it straight away; anyone else's posts a card with a button only the GM can use. No token:
 * the run stops (with a warning). Dozer Blade's Alt Mode.
 */

const T = (key, data) => (data ? globalThis.game?.i18n?.format?.(key, data) : globalThis.game?.i18n?.localize?.(key)) ?? key;
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Rough Terrain Regions (system Environment Behavior, roughTerrain on) with a rectangle holding the point. */
export function roughRegionsAt(scene, point) {
  const regions = Array.from(scene?.regions ?? []);
  return regions.filter(region => Array.from(region.behaviors ?? []).some(b => b.system?.roughTerrain)
    && (region.shapes ?? []).some(s => s.type == 'rectangle' && point.x >= s.x && point.x <= s.x + s.width
      && point.y >= s.y && point.y <= s.y + s.height));
}

/** Deletes the one-square Rough Terrain Regions at the point; how many went. */
export async function clearRoughTerrain(scene, point) {
  const square = (scene?.grid?.size ?? 100) ** 2;
  const small = roughRegionsAt(scene, point).filter(r => (r.shapes ?? []).reduce((a, s) => a + (s.width ?? 0) * (s.height ?? 0), 0) <= square * 1.01);
  if (small.length) {
    await scene.deleteEmbeddedDocuments('Region', small.map(r => r.id));
  }

  return small.length;
}

registerStep('clearRoughTerrain', async (step, ctx) => {
  const actor = ctx.actor;
  const token = actor?.getActiveTokens?.()?.[0];
  if (!token) {
    globalThis.ui?.notifications?.warn?.(T('E20.RulesExtSplit217.NeedsToken'));
    return false;
  }

  const point = token.center;
  if (globalThis.game?.user?.isGM) {
    const cleared = await clearRoughTerrain(token.scene ?? globalThis.canvas?.scene, point);
    ctx.chat.push(esc(T(cleared ? 'E20.RulesExtSplit217.TerrainCleared' : 'E20.RulesExtSplit217.TerrainAskGm', { name: actor.name })));
    return;
  }

  const sceneId = globalThis.canvas?.scene?.id ?? token.scene?.id ?? '';
  await globalThis.ChatMessage?.create?.({
    speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
    content: `<p>${esc(T('E20.RulesExtSplit217.TerrainAskGm', { name: actor.name }))}</p><button type="button" data-e20-ext="clearRoughTerrain" data-scene="${esc(sceneId)}" data-x="${point.x}" data-y="${point.y}">${esc(T('E20.RulesExtSplit217.TerrainClearButton'))}</button>`,
  });
  // The card says it all: the run stops here quietly, so the Use posts nothing of its own.
  return false;
});

registerChatButton('clearRoughTerrain', async (message, button) => {
  if (!globalThis.game?.user?.isGM) {
    return;
  }

  const scene = globalThis.game.scenes?.get?.(button.dataset.scene);
  const cleared = await clearRoughTerrain(scene, { x: Number(button.dataset.x), y: Number(button.dataset.y) });
  globalThis.ui?.notifications?.info?.(T(cleared ? 'E20.RulesExtSplit217.TerrainClearedGm' : 'E20.RulesExtSplit217.TerrainNothing'));
  button.disabled = true;
});
