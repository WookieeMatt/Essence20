import { getItemsOfType } from "../helpers/utils.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";
import { onPerkDrop } from "./perk-handler.mjs";

/**
 * Function for dropping a faction on to an actor.
 * @param {Actor} actor The actor that the faction is being dropped on.
 * @param {Function} dropFunc The drop function for the item being dropped.
 * @returns
 */
export async function onFactionDrop(actor, dropFunc=null, newFaction=null) {
  if(!newFaction) {
    const hasFaction = getItemsOfType("faction", actor.items).length > 0;
    if (hasFaction) {
      ui.notifications.error(game.i18n.localize('E20.FactionMultipleError'));
      return false;
    }
  }

  if (dropFunc) {
    const factionDrop = await dropFunc();
    newFaction = factionDrop[0];
  }

  const perks = getItemsOfType('perk', Object.values(newFaction.system.items));

  for (const perk of perks) {
    const itemToCreate = await fromUuid(perk.uuid);
    onPerkDrop(actor, itemToCreate, null, null, null, newFaction);
  }
}

/**
 * Function for deleting a faction from an actor
 * @param {Item} faction The faction that is being deleted from the actor.
 * @param {Actor} actor The actor the faction is being deleted from.
 */
export async function onFactionDelete(faction, actor) {
  deleteAttachmentsForItem(faction, actor);
}
