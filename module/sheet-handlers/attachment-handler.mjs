import {
  getItemsOfType,
  itemDeleteById,
  rememberOptions,
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
  async attachItem(parentType, dropFunc) {
    const upgradableItems = await getItemsOfType(parentType, this._actor.items);

    if (upgradableItems.length == 1) {
      this._attachItem(upgradableItems[0], dropFunc);
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
                rememberOptions(html), dropFunc,
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
  async _attachSelectedItemOptionHandler(options, dropFunc) {
    for (const [itemId, isSelected] of Object.entries(options)) {
      if (isSelected) {
        const item = this._actor.items.get(itemId);
        this._attachItem(item, dropFunc);
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
  async _attachItem(item, dropFunc) {
    if (item) {
      const attachmentList = await dropFunc();
      const newAttachment = attachmentList[0];
      const itemAttachmentIds = item.system[`${newAttachment.type}Ids`];
      itemAttachmentIds.push(newAttachment._id);
      await item.update({ [`system.${newAttachment.type}Ids`]: itemAttachmentIds });
    }
  }

  /**
  * Handle deleting the attachments of an item from an Actor Sheet
  * @param {Item} item                The Item
  * @param {String[]} attachmentTypes The types of attachments the Item has
  */
  deleteAttachments(item, attachmentTypes) {
    for (const attachmentType of attachmentTypes) {
      for (const attachmentId of item.system[`${attachmentType}Ids`]) {
        itemDeleteById(attachmentId, this._actor);
      }
    }
  }
}
