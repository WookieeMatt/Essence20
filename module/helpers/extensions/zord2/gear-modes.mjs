/**
 * Weapons and gear that change what they do with a mode switch, plus two Beast Mode chassis.
 *
 * - Deflecting Weapons (Quartermaster's Guide to Gear, p.36: Combat Nunchaku, Excalibur) are item rules
 *   now - two Defense rules and a Use that flips their shieldMode toggle; ./unusable.mjs still refuses
 *   an attack while it's on.
 * - Rotary Blade (Technorganic Secrets, p.48-49). Slasher Mode: "Spend a Move action to switch
 *   Rotary Blade to its Cyber Shield Mode". Cyber Shield Mode: "When active, gain +1 to Toughness
 *   and Evasion. You may also spend a Standard action while falling to spin the shield into a
 *   controlled descent and take no damage. Spend a Move action to switch Rotary Blade back to
 *   Slasher Mode."
 * - Dozer Blade (TF CRB, p.134): "Alt Mode: You can clear one square of Rough Terrain you Move
 *   through as a Free action. Bot Mode: Your dozer blade acts as a shield, providing +2 Deflection
 *   bonus to Toughness." The Bot Mode +2 is an item rule now (system.rules); the Alt Mode Use stays here.
 * - Carapaced (Technorganic Secrets, p.37): "Alt Mode Movement: 40 feet Ground. Choose either to add
 *   20 feet to your Ground speed or gain a 25 feet Underground speed." Primate (p.42): "Alt Mode
 *   Movement: 50 feet Ground, 30 feet Climb." The Alt Mode item only stores ground/aerial/aquatic;
 *   the Climb and Underground speeds are item rules now, the +20 Ground is added here while in that
 *   Alt Mode.
 * - Shinobi of the 63rd Hexagram (Intercontinental Adventures, p.9): "You gain +1 to either
 *   Toughness or Evasion and +1 to either Willpower or Cleverness" - the item carries all four as
 *   disabled Active Effects; this turns on the chosen two. "Trained in all weapons with the Martial
 *   Arts trait" is a plain Active Effect on the item. "You roll Driving Skill Tests to drive
 *   motorcycles without a Snag, even if you have no Ranks in the Driving Skill" - ./snag.mjs.
 */
import { registerChatButton, registerDerived, registerUse } from "../../extensions.mjs";
import { chat, holds, itemsOf, sourceOf, sourced, T, ZORD2 } from "./common.mjs";

const flagOf = (doc, key) => doc?.flags?.essence20?.[key];
export const SHIELD_MODE = 'zord2ShieldMode';
export const CARAPACED_FLAG = 'zord2CarapacedChoice';

export function gearDerived(actor) {
  const system = actor?.system;
  if (!system?.defenses) return;
  const items = itemsOf(actor);

  // Primate's Climb 30 and Carapaced's Underground 25 are DerivedStat rules on the Alt Mode items.
  if (system.isTransformed && system.altModeId && system.movement) {
    const altMode = items.find(i => i.id == system.altModeId);
    if ([ZORD2.carapacedCommon, ZORD2.carapacedLarge].includes(sourceOf(altMode)) && flagOf(altMode, CARAPACED_FLAG) != 'burrow'
      && system.movement.ground) {
      system.movement.ground.total = (system.movement.ground.total ?? 0) + 20;
    }
  }
}

registerDerived(gearDerived);

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function rotaryShield(actor, weapon) {
  let shield = sourced(actor, ZORD2.rotaryBladeShield)[0];
  if (!shield) {
    const { grantCopy } = await import("../../grants.mjs");
    shield = await grantCopy(actor, ZORD2.rotaryBladeShield, { grantedBy: weapon });
  }

  return shield;
}

export async function rotaryToShield(actor, pay) {
  if (!(await pay('move'))) return null;
  const weapon = sourced(actor, ZORD2.rotaryBladeWeapon)[0];
  const shield = await rotaryShield(actor, weapon);
  if (weapon) await weapon.setFlag('essence20', SHIELD_MODE, true);
  if (shield) await shield.update({ 'system.equipped': true, 'system.active': true });
  return T('Zord2RotaryShield', { name: actor.name });
}

export async function rotaryToSlasher(actor, pay) {
  if (!(await pay('move'))) return null;
  const weapon = sourced(actor, ZORD2.rotaryBladeWeapon)[0];
  const shield = sourced(actor, ZORD2.rotaryBladeShield)[0];
  if (weapon) await weapon.setFlag('essence20', SHIELD_MODE, false);
  if (shield) await shield.update({ 'system.active': false });
  return T('Zord2RotarySlasher', { name: actor.name });
}

async function useRotaryShield(shield, pay) {
  const actor = shield.parent;
  if (!shield.system?.active) {
    return rotaryToShield(actor, pay);
  }

  const { chooseButtons } = await import("../../grants.mjs");
  const choice = await chooseButtons(shield.name, T('Zord2RotaryPrompt'), [['descent', T('Zord2RotaryDescent')], ['slasher', T('Zord2RotaryToSlasher')]]);
  if (choice == 'descent') {
    if (!(await pay('standard'))) return null;
    return T('Zord2RotaryDescentDone', { name: actor.name });
  }

  return choice == 'slasher' ? rotaryToSlasher(actor, pay) : null;
}

async function pickCarapaced(altMode) {
  const { chooseButtons } = await import("../../grants.mjs");
  const choice = await chooseButtons(altMode.name, T('Zord2CarapacedPrompt'), [['ground', T('Zord2CarapacedGround')], ['burrow', T('Zord2CarapacedBurrow')]]);
  if (!choice) return null;
  await altMode.setFlag('essence20', CARAPACED_FLAG, choice);
  return T(choice == 'burrow' ? 'Zord2CarapacedBurrow' : 'Zord2CarapacedGround');
}

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
  const { chooseButtons } = await import("../../grants.mjs");
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
    return [ZORD2.rotaryBladeWeapon, ZORD2.rotaryBladeShield, ZORD2.carapacedCommon, ZORD2.carapacedLarge, ZORD2.shinobi].includes(source)
      || (source == ZORD2.dozerBlade && !!item.parent?.system?.isTransformed);
  },
  canUse: item => sourceOf(item) != ZORD2.rotaryBladeWeapon || !flagOf(item, SHIELD_MODE),
  run: async (item, economy, pay) => {
    const source = sourceOf(item);
    if (source == ZORD2.rotaryBladeWeapon) return rotaryToShield(item.parent, pay);
    if (source == ZORD2.rotaryBladeShield) return useRotaryShield(item, pay);
    if (source == ZORD2.dozerBlade) return useDozerBlade(item, pay);
    if (source == ZORD2.shinobi) return pickShinobi(item);
    return pickCarapaced(item);
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
