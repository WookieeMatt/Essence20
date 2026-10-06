/**
 * Weapons and gear that change what they do with a mode switch, plus two Beast Mode chassis.
 *
 * - Deflecting Weapons (Quartermaster's Guide to Gear, p.36: Combat Nunchaku, Excalibur) are item rules
 *   now - two Defense rules and a Use that flips their shieldMode toggle; ./unusable.mjs still refuses
 *   an attack while it's on.
 * - Rotary Blade (Technorganic Secrets, p.48-49) is item rules now - the blade's shieldMode Toggle and
 *   the Use buttons on the blade and its shield; ./unusable.mjs still refuses an attack in shield mode.
 * - Dozer Blade (TF CRB, p.134): "Alt Mode: You can clear one square of Rough Terrain you Move
 *   through as a Free action. Bot Mode: Your dozer blade acts as a shield, providing +2 Deflection
 *   bonus to Toughness." The Bot Mode +2 is an item rule now (system.rules); the Alt Mode Use stays here.
 * - Carapaced (Technorganic Secrets, p.37) and Primate (p.42) are item rules now: the Ground /
 *   Underground pick (a Use), the +20 Ground (a Movement rule, stage afterDerived), the Underground
 *   and Climb speeds (DerivedStats).
 * - Shinobi of the 63rd Hexagram (Intercontinental Adventures, p.9): "You gain +1 to either
 *   Toughness or Evasion and +1 to either Willpower or Cleverness" - the item carries all four as
 *   disabled Active Effects; this turns on the chosen two. "Trained in all weapons with the Martial
 *   Arts trait" is a plain Active Effect on the item. "You roll Driving Skill Tests to drive
 *   motorcycles without a Snag, even if you have no Ranks in the Driving Skill" - ./snag.mjs.
 */
import { registerChatButton, registerUse } from "../../mechanics/item-hooks.mjs";
import { chat, holds, sourceOf, T, ZORD2 } from "../zords/combiner-roster-helpers.mjs";

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

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

/* -------------------------------------------- */
/*  Shinobi of the 63rd Hexagram                 */
/* -------------------------------------------- */

const SHINOBI_KEYS = {
  toughness: 'system.defenses.toughness.bonus',
  evasion: 'system.defenses.evasion.bonus',
  willpower: 'system.defenses.willpower.bonus',
  cleverness: 'system.defenses.cleverness.bonus',
};

export async function pickShinobi(perk) {
  const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
  const defense = key => game.i18n.localize(CONFIG.E20.defenses[key]);
  const body = await chooseButtons(perk.name, T('Zord2ShinobiPick'), [['toughness', defense('toughness')], ['evasion', defense('evasion')]]);
  if (!body) return null;
  const mind = await chooseButtons(perk.name, T('Zord2ShinobiPick'), [['willpower', defense('willpower')], ['cleverness', defense('cleverness')]]);
  if (!mind) return null;

  const chosen = [SHINOBI_KEYS[body], SHINOBI_KEYS[mind]];
  const updates = Array.from(perk.effects ?? [])
    .filter(e => (e.changes ?? []).some(c => Object.values(SHINOBI_KEYS).includes(c.key)))
    .map(e => ({ _id: e.id, disabled: !(e.changes ?? []).some(c => chosen.includes(c.key)) }));
  if (updates.length) await perk.updateEmbeddedDocuments('ActiveEffect', updates);
  return T('Zord2ShinobiChosen', { a: defense(body), b: defense(mind) });
}

/* -------------------------------------------- */
/*  Wiring                                       */
/* -------------------------------------------- */

registerUse({
  id: 'zord2-gear-modes',
  matches: item => {
    const source = sourceOf(item);
    return source == ZORD2.shinobi || (source == ZORD2.dozerBlade && !!item.parent?.system?.isTransformed);
  },
  run: async (item, economy, pay) => {
    const source = sourceOf(item);
    if (source == ZORD2.dozerBlade) return useDozerBlade(item, pay);
    return pickShinobi(item);
  },
});

if (typeof Hooks != 'undefined') {
  Hooks.on('createItem', async (item, options, userId) => {
    if (userId != game.user?.id || sourceOf(item) != ZORD2.shinobi || !item.parent) return;
    const line = await pickShinobi(item);
    if (line) await chat(item.parent, line);
  });
}

export { holds };
