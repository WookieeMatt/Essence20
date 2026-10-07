import { registerTag } from "../../predicate.mjs";
import { itemsOf } from "../../../items/shared/item-lookups.mjs";
import { isPrintedUnarmedWeapon, isUnarmedAttack } from "../../../items/shared/unarmed-attacks.mjs";

export { UNARMED_WEAPON_IDS, isPrintedUnarmedWeapon } from "../../../items/shared/unarmed-attacks.mjs";

/**
 * Round 15 (dice part), plus the shared unarmed definition (items/shared/unarmed-attacks.mjs#isUnarmedAttack - no
 * weapon behind the attack, or one of the printed unarmed "weapons": G.I. JOE / Transformers / Power Rangers Unarmed
 * Combat, Night Vale's Unarmed Strike).
 *
 *  - `attack:barehanded` - the rolled weaponEffect is unarmed. Same definition as the core `attack:unarmed`; the one
 *    difference is that it only needs the roll not to be flagged a non-attack (ctx.isAttack === false), where
 *    `attack:unarmed` needs ctx.isAttack set - so it also answers on the item alone (DamageType, Cold Touch).
 *  - `self:holdingWeapon` / `target:holdingWeapon` - an equipped weapon that isn't one of those printed unarmed ones
 *    (Empty Hands' "wielding no weapons"; `self:itemCount:weapon:equipped<1` counts them too).
 *  - `roll:dealsDamage` - some row of the roll carries damage (Brazen Strike).
 */

/** An unarmed attack - isUnarmedAttack under its older name. */
export function isBarehandedAttack(item, actor = null) {
  return isUnarmedAttack(item, actor);
}

registerTag('attack:barehanded', (rest, ctx) => (ctx.isAttack === false ? false : isBarehandedAttack(ctx.item, ctx.self)), { phrase: ['on barehanded attacks', 'except on barehanded attacks'] });

// roll:dealsDamage - some row of the roll came with damage (afterRoll / hit Triggers: the card's rows). Unknown outside a
// posted roll. (roll:damaging reads only the first row.)
registerTag('roll:dealsDamage', (rest, ctx) => (Array.isArray(ctx.results) ? ctx.results.some(row => (Number(row?.damageValue) || 0) > 0) : null), { phrase: ['the roll deals damage', 'the roll deals no damage'] });

const holding = actor => (actor ? itemsOf(actor).some(item => item.type == 'weapon' && item.system?.equipped && !isPrintedUnarmedWeapon(item)) : null);
registerTag('self:holdingWeapon', (rest, ctx) => holding(ctx.self), { phrase: ['{who} {is} holding a weapon', '{who} {isnt} holding a weapon'] });
registerTag('target:holdingWeapon', (rest, ctx) => holding(ctx.other), { phrase: ['{who} {is} holding a weapon', '{who} {isnt} holding a weapon'] });
