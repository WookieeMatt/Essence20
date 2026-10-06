import { registerTag } from "../../predicate.mjs";
import { itemsOf, listOf } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2): `self:ownerSpectrum:<colour>` - the Ranger this Zord belongs to (the character whose sheet lists it)
 * has a Role naming that spectrum colour ("Black Ranger" - black, blue, green, pink, red, yellow); `none` - no owner,
 * or a Role of another spectrum. Versatile Combiner's Megaform Trait by colour.
 */

const COLOURS = ['black', 'blue', 'green', 'pink', 'red', 'yellow'];

/** The character whose roster lists this Zord. */
export function zordOwner(zord) {
  return listOf(globalThis.game?.actors).find(actor => ['playerCharacter', 'npc'].includes(actor?.type)
    && Object.values(actor.system?.actors ?? {}).some(entry => entry?.uuid == zord?.uuid)) ?? null;
}

/** A character's spectrum colour, from their Role's name, or null. */
export function spectrumOf(actor) {
  const role = itemsOf(actor).find(item => item.type == 'role');
  const match = new RegExp(`\\b(${COLOURS.join('|')})\\b`, 'i').exec(role?.name ?? '');
  return match ? match[1].toLowerCase() : null;
}

registerTag('self:ownerSpectrum', (rest, ctx) => {
  const colour = spectrumOf(zordOwner(ctx?.self));
  return String(rest).toLowerCase() == 'none' ? !colour : colour == String(rest).toLowerCase();
});
