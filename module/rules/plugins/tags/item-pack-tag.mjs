import { registerTag } from "../../predicate.mjs";
import { sourceOf } from "../../../items/shared/item-lookups.mjs";

/**
 * Tag `item:pack:<pack>|<pack>...` (round 15, items1) - the item (a compendium entry, or an owned item by its book source)
 * comes from one of those system packs: `item:pack:mlp_crb|knights_of_canterlot|dark_skies_over_equestria` - every My Little
 * Pony book, which item:line:mlp doesn't all count (Multimorph's other Origins).
 */

/** The system pack a compendium uuid (Compendium.essence20.<pack>.Item.<id>) is in, or null. */
export function packOf(uuid) {
  const parts = String(uuid ?? '').split('.');
  return parts[0] == 'Compendium' && parts.length >= 5 ? parts[2] : null;
}

registerTag('item:pack', (rest, ctx) => {
  const item = ctx.item;
  if (!item) {
    return false;
  }

  const pack = packOf(String(item.uuid ?? '').startsWith('Compendium.') ? item.uuid : sourceOf(item));
  return !!pack && String(rest).split('|').includes(pack);
}, { phrase: arg => [`{who} {is} from ${arg.split('|').join(' or ')}`, `{who} {isnt} from ${arg.split('|').join(' or ')}`] });
