import { actorHasPerk } from "./perks.mjs";

/**
 * Antlers (Dark Skies Over Equestria, Metamorphosed Changeling Natural Shape power, p.16):
 * "Double the reach of your unarmed attacks." A flat, always-on reachMultiplier override for
 * unarmed weaponEffect rolls, the same data/item/weapon-effect.mjs#prepareDerivedData
 * reachMultiplier pipeline Extended Attack/Mass Shift already feed into for melee attacks
 * generally - this one is unarmed-only (RAW's own "unarmed attacks", not "melee attacks"), so it
 * doesn't stack with a held weapon's own printed Reach the way those two do.
 */

const ANTLERS_ID = "Compendium.essence20.dark_skies_over_equestria.Item.MIqTCcA1vXERwPYv";

/**
 * Whether the given actor's Antlers should double THIS weaponEffect's reach - the actor holds
 * the Perk and the attack is unarmed (no parent weapon Item).
 * @param {Actor} actor
 * @param {Boolean} isUnarmed   Whether the rolling weaponEffect has no parent weapon Item.
 * @returns {Boolean}
 */
export function isAntlersReachActive(actor, isUnarmed) {
  return !!isUnarmed && actorHasPerk(actor, ANTLERS_ID);
}
