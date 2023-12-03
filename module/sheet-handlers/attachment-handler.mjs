import {
  getItemsOfType,
  rememberOptions,
  setEntry,
} from "../helpers/utils.mjs";

export class AttachmentHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Initiates the process to apply an attachment item to an item on the actor sheet
   * @param {Item} attachment   The attachment
   * @param {Function} dropFunc The function to call to complete the drop
   */
  async attachItem(droppedItem) {
    let parentType = "";
    if (droppedItem.system.type) {
      parentType = droppedItem.system.type;
    } else if (droppedItem.type == 'weaponEffect') {
      parentType = "weapon";
    }

    const upgradableItems = await getItemsOfType(parentType, this._actor.items);

    if (upgradableItems.length == 1) {
      this._attachItem(upgradableItems[0], droppedItem);
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
              callback: html => this._attachSelectedItemOptionHandler(
                rememberOptions(html), droppedItem,
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
   * @param {Object} options    The options resulting from _showAttachmentDialog()
   * @param {Function} dropFunc The function to call to complete the drop
   * @private
   */
  async _attachSelectedItemOptionHandler(options, droppedItem) {
    for (const [itemId, isSelected] of Object.entries(options)) {
      if (isSelected) {
        const item = this._actor.items.get(itemId);
        this._attachItem(item, droppedItem);
        break;
      }
    }
  }

  /**
   * Creates the attachment for the actor and attaches it to the given item
   * @param {Item} item         The item to attach to
   * @param {Function} dropFunc The function to call to complete the drop
   * @private
   */
  async _attachItem(targetItem, droppedItem) {
    if (targetItem) {
      await setEntry(droppedItem, targetItem);
    }
  }

//   /**
//   * Handle deleting the attachments of an item from an Actor Sheet
//   * @param {Item} item                The Item
//   * @param {String[]} attachmentTypes The types of attachments the Item has
//   */
//   deleteAttachments(item) {
//     for (const [key,deletedItem] of Object.entries(item.system.items)) {
//       console.log(key);
//       for (const actorItem of this._actor.items) {
//         const itemSourceId = this._actor.items.get(actorItem._id).getFlag('core', 'sourceId');
//         const parentId = this._actor.items.get(actorItem._id).getFlag('essence20', 'parentId');
//         if (itemSourceId == deletedItem.uuid) {
//           if (item._id == parentId) {
//             actorItem.delete();
//           }
//         }
//       }
//     }
//   }
}
