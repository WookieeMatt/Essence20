import {
  createItemCopies,
  getItemsOfType,
  rememberOptions,
  setEntryAndAddItem,
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
  * @param {Item} droppedItem   The attachment
  */
  async gearDrop(droppedItem, dropFunc) {
    const newGearList = await dropFunc();
    console.log(droppedItem);
    if (droppedItem.system.items) {
      await createItemCopies(droppedItem.system.items, this._actor, "upgrade", newGearList[0]);
      if (droppedItem.type == 'weapon') {
        await createItemCopies(droppedItem.system.items, this._actor, "weaponEffect", newGearList[0]);
      }
    }
  }

  /**
   * Initiates the process to apply an attachment item to an item on the actor sheet
   * @param {Item} droppedItem   The attachment
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
   * @param {Item} targetItem         The item to attach to
   * @param {Item} droppedItem The item being attached
   * @private
   */
  async _attachItem(targetItem, droppedItem) {
    if (targetItem) {
      await setEntryAndAddItem(droppedItem, targetItem);
    }
  }

}
