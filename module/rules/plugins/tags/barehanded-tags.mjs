import { registerTag } from "../../predicate.mjs";

/**
 * Round 15 (dice part): unarmed the way dice.mjs#_isUnarmedWeaponEffect reads it - an attack with no weapon behind it,
 * OR one of the printed unarmed "weapons" (G.I. JOE / Transformers Unarmed Combat, Night Vale's Unarmed Strike), whose
 * attacks do carry a parent. (The core `attack:unarmed` is "no weapon" only - the rules built on it keep that reading.)
 *
 *  - `attack:barehanded` - the rolled weaponEffect is unarmed in that wider sense.
 *  - `self:holdingWeapon` / `target:holdingWeapon` - an equipped weapon that isn't one of those printed unarmed ones
 *    (Empty Hands' "wielding no weapons"; `self:itemCount:weapon:equipped<1` counts them too).
 *  - `roll:dealsDamage` - some row of the roll carries damage (Brazen Strike).
 */

export const UNARMED_WEAPON_IDS = [
  "Compendium.essence20.gi_joe_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy",
  "Compendium.essence20.wtnv_citizens_guide.Item.Cwd1FASmKXWiAFom",
];

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;

/** Whether this weapon item is one of the printed unarmed "weapons". */
export function isPrintedUnarmedWeapon(weapon) {
  return !!weapon && UNARMED_WEAPON_IDS.includes(sourceOf(weapon));
}

const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);

/** The weapon a weaponEffect belongs to (on its own actor), or null. */
function parentWeapon(item, actor) {
  const parentId = item?.flags?.essence20?.parentId;
  if (!parentId) {
    return null;
  }

  const owner = item.parent ?? item.actor ?? actor;
  return owner?.items?.get?.(parentId) ?? itemsOf(owner).find(entry => entry.id == parentId) ?? null;
}

/** An unarmed attack in dice.mjs's sense: no weapon behind it, or a printed unarmed weapon. */
export function isBarehandedAttack(item, actor = null) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  const weapon = parentWeapon(item, actor);
  return !weapon || isPrintedUnarmedWeapon(weapon);
}

registerTag('attack:barehanded', (rest, ctx) => (ctx.isAttack === false ? false : isBarehandedAttack(ctx.item, ctx.self)));

// roll:dealsDamage - some row of the roll came with damage (afterRoll / hit Triggers: the card's rows). Unknown outside a
// posted roll. (roll:damaging reads only the first row.)
registerTag('roll:dealsDamage', (rest, ctx) => (Array.isArray(ctx.results) ? ctx.results.some(row => (Number(row?.damageValue) || 0) > 0) : null));

const holding = actor => (actor ? itemsOf(actor).some(item => item.type == 'weapon' && item.system?.equipped && !isPrintedUnarmedWeapon(item)) : null);
registerTag('self:holdingWeapon', (rest, ctx) => holding(ctx.self));
registerTag('target:holdingWeapon', (rest, ctx) => holding(ctx.other));
