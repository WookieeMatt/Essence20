import { registerPreRoll, registerUse } from "../../extensions.mjs";
import { D21, T, escape, findSourced, itemsOf, postLine, sourceOf } from "./common.mjs";

/**
 * Finster's Monster-Matic Cookbook, Psycho Rangers (Chapter 5):
 *
 * - Stinger Spray (Path of Venom, 9th level, p.300): "you can release a barrage of envenomed stinging
 *   needles while in your Monster Form. As a Standard action, spend 1 Personal Power to make a
 *   Targeting attack with a Range of 60ft/120ft. This attack deals 1 Poison damage and has the
 *   Alternate Effects ... This attack has the Multi-Weapon (3) and Poison Traits." The weapon already
 *   exists in the pack (Stinger Spray, iOq7mriMr4BCBl78, Multiple Targets 3); the Perk now grants it,
 *   and each attack with it spends the Personal Power and needs the Monster Form.
 * - Psycho Kit (every Path, e.g. p.285): "gain the following items from your Morphin Grid access
 *   portal ... Psycho Morpher ... Wrist Communicator ... Any [Heavy/Versatile/Medium/Projectile/
 *   2-handed] Psycho Weapon*" - a Use button on the Psycho Morpher picks the Path's Psycho Weapon
 *   (Table 5-8, p.302) and grants it once.
 */

/* -------------------------------------------- */
/*  Stinger Spray                                */
/* -------------------------------------------- */

/** The Perk brings its attack with it; the attack goes when the Perk does. */
export async function grantStingerSpray(item, options, userId) {
  const actor = item?.parent;
  if (userId != game.user?.id || !actor || sourceOf(item) != D21.stingerSprayPerk || findSourced(actor, D21.stingerSprayWeapon)) {
    return null;
  }

  const { grantCopy } = await import("../../grants.mjs");
  return grantCopy(actor, D21.stingerSprayWeapon, { grantedBy: item });
}

export async function dropStingerSpray(item, options, userId) {
  const actor = item?.parent;
  if (userId != game.user?.id || !actor || sourceOf(item) != D21.stingerSprayPerk) {
    return;
  }

  const granted = itemsOf(actor).filter(i => i.flags?.essence20?.grantedBy == item.id);
  const ids = [...granted, ...itemsOf(actor).filter(i => granted.some(g => i.flags?.essence20?.parentId == g.id))].map(i => i.id);
  if (ids.length) {
    await actor.deleteEmbeddedDocuments('Item', [...new Set(ids)]);
  }
}

Hooks.on('createItem', grantStingerSpray);
Hooks.on('deleteItem', dropStingerSpray);

/**
 * "while in your Monster Form ... spend 1 Personal Power" - paid as the attack is rolled. The roll
 * can't be stopped from here, so a missing Monster Form or an empty pool is called out on the card.
 */
export async function stingerSprayCost(actor, dataset, item) {
  if (!actor || item?.type != 'weaponEffect' || !D21.stingerSprayEffects.includes(sourceOf(item))) {
    return;
  }

  const { isMonsterFormActive } = await import("../../monster-morph.mjs");
  if (!isMonsterFormActive(actor)) {
    ui.notifications?.warn?.(T('D21StingerSprayNeedsForm', { name: actor.name }));
  }

  const power = Number(actor.system?.powers?.personal?.value) || 0;
  if (power < 1) {
    ui.notifications?.warn?.(T('D21StingerSprayNoPower', { name: actor.name }));
    return;
  }

  await actor.update({ 'system.powers.personal.value': power - 1 });
  await postLine(actor, T('D21StingerSprayPaid', { name: escape(actor.name) }));
}

registerPreRoll(stingerSprayCost);

/* -------------------------------------------- */
/*  Psycho Kit weapon                            */
/* -------------------------------------------- */

const HEAVY = [D21.psychoScythe, D21.psychoSword, D21.psychoTrident];
const VERSATILE = [D21.psychoAxe, D21.psychoBlade];
const MEDIUM = [D21.psychoAxe, D21.psychoBlade, D21.psychoBow, D21.psychoStaff];
const PROJECTILE = [D21.psychoBlaster, D21.psychoBow, D21.psychoSlinger];
const TWO_HANDED = [D21.psychoBow, D21.psychoScythe, D21.psychoStaff, D21.psychoSlinger, D21.psychoSword, D21.psychoTrident];
export const ALL_PSYCHO_WEAPONS = [
  D21.psychoAxe, D21.psychoBlade, D21.psychoBlaster, D21.psychoBow, D21.psychoDagger,
  D21.psychoScythe, D21.psychoStaff, D21.psychoSlinger, D21.psychoSword, D21.psychoTrident,
];

// Each Path's Psycho Kit (pp.282-300): Cruelty "Any Psycho Weapon", Flame "Any Heavy", Frost "Any
// Versatile", Stone "Any Medium", Thorns "Any Projectile", Venom "Any 2-handed".
export const KIT_WEAPONS = {
  [D21.pathCruelty]: ALL_PSYCHO_WEAPONS,
  [D21.pathFlame]: HEAVY,
  [D21.pathFrost]: VERSATILE,
  [D21.pathStone]: MEDIUM,
  [D21.pathThorns]: PROJECTILE,
  [D21.pathVenom]: TWO_HANDED,
};

export function kitWeaponsFor(actor) {
  const role = itemsOf(actor).find(item => item.type == 'role' && KIT_WEAPONS[sourceOf(item)]);
  return role ? KIT_WEAPONS[sourceOf(role)] : ALL_PSYCHO_WEAPONS;
}

export async function usePsychoKit(item) {
  const actor = item?.parent;
  if (!actor) {
    return null;
  }

  const allowed = kitWeaponsFor(actor);
  const options = [];
  for (const uuid of allowed) {
    const entry = fromUuidSync?.(uuid);
    options.push({ value: uuid, label: entry?.name ?? uuid.split('.').pop() });
  }

  const { chooseSelect, grantCopy } = await import("../../grants.mjs");
  const picked = await chooseSelect(item.name, T('D21PsychoKitPrompt'), options);
  if (!picked) {
    return null;
  }

  const weapon = await grantCopy(actor, picked, { grantedBy: item });
  if (!weapon) {
    return null;
  }

  await item.setFlag('essence20', 'd21PsychoKitWeapon', weapon.id);
  return T('D21PsychoKitGranted', { name: escape(actor.name), weapon: escape(weapon.name) });
}

registerUse({
  id: 'd21PsychoKit',
  matches: item => sourceOf(item) == D21.psychoMorpher,
  canUse: item => !item?.parent?.items?.get?.(item.flags?.essence20?.d21PsychoKitWeapon),
  run: item => usePsychoKit(item),
});
