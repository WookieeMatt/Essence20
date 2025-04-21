import { getItemsOfType } from "../helpers/utils.mjs";
import { deleteAttachmentsForItem } from "./attachment-handler.mjs";
import { onPerkDrop } from "./perk-handler.mjs";

/**
 * Function for dropping a faction on to an actor.
 * @param {Actor} actor The actor that the faction is being dropped on.
 * @param {Function} dropFunc The drop function for the item being dropped.
 * @returns
 */
export async function onFactionDrop(actor, dropFunc) {
  const hasFaction = getItemsOfType("faction", actor.items).length > 0;
  if (hasFaction) {
    ui.notifications.error(game.i18n.localize('E20.FactionMultipleError'));
    return false;
  }

  const factionDrop = await dropFunc();
  const newFaction = factionDrop[0];

  for (const [, item] of Object.entries(newFaction.system.items)) {
    if (item.type == "perk") {
      const itemToCreate = await fromUuid(item.uuid);
      onPerkDrop(actor, itemToCreate, null, null, null, newFaction);
    }
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