import { rememberOptions } from "../helpers/dialog.mjs";
import {
  createItemCopies,
  getItemsOfType,
  setEntryAndAddItem,
} from "../helpers/utils.mjs";

/**
 * Handles dropping items that have attachments onto an Actor
 * @param {Actor} actor The Actor receiving the item
 * @param {Item} droppedItem The item being dropped
 * @param {Function} dropFunc The function to call to complete the drop
 */
export async function gearDrop(actor, droppedItem, dropFunc) {
  const newGearList = await dropFunc();
  if (droppedItem.system.items) {
    await createItemCopies(droppedItem.system.items, actor, "upgrade", newGearList[0]);
    if (droppedItem.type == 'weapon') {
      await createItemCopies(droppedItem.system.items, actor, "weaponEffect", newGearList[0]);
    }
  }
}

/**
 * Initiates the process to apply an attachment item to an item on the actor sheet
 * @param {Actor} actor The Actor receiving the attachment
 * @param {Item} droppedItem The attachment being dropped
 * @param {Function} dropFunc The function to call to complete the drop
 */
export async function attachItem(actor, droppedItem, dropFunc) {
  let parentType = "";
  if (droppedItem.system.type) {
    parentType = droppedItem.system.type;
  } else if (droppedItem.type == 'weaponEffect') {
    parentType = "weapon";
  }

  const upgradableItems = getItemsOfType(parentType, actor.items);

  if (upgradableItems.length == 1) {
    _attachItem(upgradableItems[0], dropFunc);
  } else if (upgradableItems.length > 1) {
    const choices = {};
    for (const upgradableItem of upgradableItems) {
      choices[upgradableItem._id] = {
        chosen: false,
        label: upgradableItem.name,
      };
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.ItemSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => _attachSelectedItemOptionHandler(
              actor, rememberOptions(html), dropFunc,
            ),
          },
        },
      },
    ).render(true);
  } else {
    ui.notifications.error(game.i18n.localize('E20.NoUpgradableItemsError'));
    return false;
  }
}

/**
 * Processes the options resulting from _showAttachmentDialog()
 * @param {Actor} actor The Actor receiving the attachment
 * @param {Object} options The options resulting from _showAttachmentDialog()
 * @param {Function} dropFunc The function to call to complete the drop
 * @private
 */
async function _attachSelectedItemOptionHandler(actor, options, dropFunc) {
  for (const [itemId, isSelected] of Object.entries(options)) {
    if (isSelected) {
      const item = actor.items.get(itemId);
      _attachItem(item, dropFunc);
      break;
    }
  }
}

/**
 * Creates the attachment for the actor and attaches it to the given item
 * @param {Item} targetItem The item to attach to
 * @param {Function} dropFunc The function to call to complete the drop
 * @private
 */
async function _attachItem(targetItem, dropFunc) {
  const newattachedItemList = await dropFunc();
  const newattachedItem = newattachedItemList[0];
  newattachedItem.setFlag('essence20', 'parentId', targetItem._id);
  if (targetItem) {
    const key = await setEntryAndAddItem(newattachedItem, targetItem);
    newattachedItem.setFlag('essence20', 'collectionId', key);
  }
}
