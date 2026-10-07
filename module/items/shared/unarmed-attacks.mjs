import { itemsOf, sourceOf } from "./item-lookups.mjs";

/**
 * The one definition of "is this attack unarmed?" (docs/rules-batches/unarmed-definition.md).
 *
 * An unarmed attack is a weaponEffect that either
 *  - has no weapon behind it (no flags.essence20.parentId - a loose or generated attack: a Threat's punch, a
 *    Mini-Con's natural attack, Knuckle Up's temporary strike...), or
 *  - belongs to one of the printed unarmed "weapons" every character gets automatically (UNARMED_WEAPON_IDS).
 *
 * Every "unarmed" reader goes through isUnarmedAttack: the `attack:unarmed` and `attack:barehanded` rule tags,
 * dice.mjs#_isUnarmedWeaponEffect (the roll context's isUnarmedAttack, which reroll.mjs's unarmedAttack condition
 * reads), action-perks.mjs#describeAttack and target-riders.mjs#buildRiderContext.
 *
 * A parentId whose weapon can't be found (no owner to look on, or a dangling id) counts as a weapon attack, not an
 * unarmed one - the conservative reading the core tag always had.
 */

/**
 * The printed unarmed "weapons" (Automatic availability, integrated melee). Matched against the copy's compendium
 * source (flags.core.sourceId / _stats.compendiumSource / rulesSource), so actors' embedded copies count, renamed or
 * not.
 *  - G.I. JOE CRB p.141 / Transformers CRB p.120: Unarmed Combat (both packs share the _id).
 *  - Welcome to Night Vale Citizens' Guide p.62: Unarmed Strike.
 *  - Power Rangers CRB (2nd Printing) p.108: Unarmed Combat (Finesse or Might, the better of the two - a rule on its
 *    effects, as G.I. JOE's). Formerly "Brawling"; the 1st printing's separate Finesse "Strike" was removed from the
 *    pack (user, 2026-10-07) - see LEGACY_UNARMED_WEAPON_IDS.
 */
export const UNARMED_WEAPON_IDS = [
  "Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom",
  "Compendium.essence20.pr_crb.Item.5Y0qpK0gnsupCNHX",
];

/** Printed unarmed weapons no longer in the packs, still matched so characters' existing copies count (the PR 1st
 *  printing's "Strike", removed 2026-10-07). */
export const LEGACY_UNARMED_WEAPON_IDS = [
  "Compendium.essence20.pr_crb.Item.YUm8S0ztubmNytbg",
];

const ALL_UNARMED_WEAPON_IDS = [...UNARMED_WEAPON_IDS, ...LEGACY_UNARMED_WEAPON_IDS];

/** Whether this weapon item is one of the printed unarmed "weapons" (an embedded copy, or the pack item itself). */
export function isPrintedUnarmedWeapon(weapon) {
  if (!weapon) {
    return false;
  }

  return ALL_UNARMED_WEAPON_IDS.includes(sourceOf(weapon)) || ALL_UNARMED_WEAPON_IDS.includes(weapon.uuid);
}

/** The weapon a weaponEffect belongs to - looked up on its own actor, else on the given one - or null. */
export function parentWeaponOf(item, actor = null) {
  const parentId = item?.flags?.essence20?.parentId;
  if (!parentId) {
    return null;
  }

  for (const owner of new Set([item.parent, item.actor, actor].filter(Boolean))) {
    const found = owner.items?.get?.(parentId) ?? itemsOf(owner).find(entry => entry.id == parentId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Whether `item` is an unarmed attack (see the module comment).
 * @param {Item} item         The rolled item.
 * @param {?Actor} actor      Where to look for its parent weapon when the item has no owner of its own.
 * @param {?Item} [weapon]    The parent weapon when the caller already has it (null: none); looked up otherwise.
 * @returns {Boolean}
 */
export function isUnarmedAttack(item, actor = null, weapon = undefined) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  if (weapon !== undefined) {
    // The caller's own lookup: no weapon is unarmed, else only a printed unarmed one.
    return !weapon || isPrintedUnarmedWeapon(weapon);
  }

  if (!item.flags?.essence20?.parentId) {
    return true;
  }

  // A parentId that resolves to nothing is a weapon attack.
  return isPrintedUnarmedWeapon(parentWeaponOf(item, actor));
}
