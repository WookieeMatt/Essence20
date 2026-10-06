/**
 * Dozer Blade (TF CRB, p.134): "Alt Mode: You can clear one square of Rough Terrain you Move
 * through as a Free action. Bot Mode: Your dozer blade acts as a shield, providing +2 Deflection
 * bonus to Toughness." The Bot Mode +2 is an item rule now (system.rules); the Alt Mode Use stays here.
 *
 * (The other gear of this slice is item rules now: Deflecting Weapons (Quartermaster's Guide to Gear, p.36: Combat
 * Nunchaku, Excalibur) - two Defense rules and a Use that flips their shieldMode toggle - and Rotary Blade (Technorganic
 * Secrets, p.48-49) - the blade's shieldMode Toggle and the Use buttons on the blade and its shield; an attack in
 * shield mode is still refused by ../attacks/shield-mode-unusable-weapons.mjs. Carapaced (Technorganic Secrets, p.37)
 * and Primate (p.42) too: the Ground / Underground pick (a Use), the +20 Ground (a Movement rule, stage afterDerived),
 * the Underground and Climb speeds (DerivedStats).)
 */
import { registerChatButton, registerUse } from "../../mechanics/item-hooks.mjs";
import { chat, ZORD2 } from "../zords/combiner-roster-helpers.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

/** Rough Terrain Regions (system Environment Behavior, roughTerrain on) with a rectangle holding the point. */
export function roughRegionsAt(scene, point) {
  const regions = Array.from(scene?.regions ?? []);
  return regions.filter(region => Array.from(region.behaviors ?? []).some(b => b.system?.roughTerrain)
    && (region.shapes ?? []).some(s => s.type == 'rectangle' && point.x >= s.x && point.x <= s.x + s.width
      && point.y >= s.y && point.y <= s.y + s.height));
}

/**
 * "Clear one square": a Rough Terrain Region no bigger than one square under the token goes (Wrecker
 * and Piledriver make exactly those); a bigger one is left to the GM, who is asked on the card.
 */
export async function clearRoughTerrain(scene, point) {
  const square = (scene?.grid?.size ?? 100) ** 2;
  const small = roughRegionsAt(scene, point).filter(r => (r.shapes ?? []).reduce((a, s) => a + (s.width ?? 0) * (s.height ?? 0), 0) <= square * 1.01);
  if (small.length) {
    await scene.deleteEmbeddedDocuments('Region', small.map(r => r.id));
  }

  return small.length;
}

async function useDozerBlade(item, pay) {
  const actor = item.parent;
  const token = actor.getActiveTokens?.()?.[0];
  if (!token) {
    ui.notifications.warn(T('Zord2NoToken'));
    return null;
  }

  if (!(await pay('free'))) return null;
  const point = token.center;
  if (game.user.isGM) {
    const cleared = await clearRoughTerrain(token.scene ?? canvas.scene, point);
    return T(cleared ? 'Zord2DozerCleared' : 'Zord2DozerAskGm', { name: actor.name });
  }

  await chat(actor, `<p>${T('Zord2DozerAskGm', { name: actor.name })}</p><button type="button" data-e20-ext="zord2ClearTerrain" data-scene="${canvas.scene?.id}" data-x="${point.x}" data-y="${point.y}">${T('Zord2DozerClearButton')}</button>`);
  return null;
}

registerChatButton('zord2ClearTerrain', async (message, button) => {
  if (!game.user.isGM) return;
  const scene = game.scenes?.get(button.dataset.scene);
  const cleared = await clearRoughTerrain(scene, { x: Number(button.dataset.x), y: Number(button.dataset.y) });
  ui.notifications.info(T(cleared ? 'Zord2DozerClearedGm' : 'Zord2DozerNothing'));
  button.disabled = true;
});

registerUse({
  id: 'zord2-dozer-blade',
  matches: item => sourceOf(item) == ZORD2.dozerBlade && !!item.parent?.system?.isTransformed,
  run: async (item, economy, pay) => useDozerBlade(item, pay),
});
