import { getItemsOfType, rememberOptions } from "../helpers/utils.mjs";

export class UpgradeHandler {
  /**
   * Constructor
   * @param {Essence20ActorSheet} actorSheet The actor sheet
   */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
   * Initiates the process to apply an upgrade to an item on the actor sheet
   * @param {Upgrade} upgrade   The upgrade
   * @param {Function} dropFunc The function to call to complete the drop
   */
  async upgradeItem(upgrade, dropFunc) {
    const upgradeType = upgrade.system.type;
    const upgradableItems = await getItemsOfType(upgradeType, this._actor.items);

    if (upgradableItems.length == 1) {
      this._upgradeItem(upgradableItems[0], dropFunc);
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
              callback: html => this._upgradeSelectedItemOptionHandler(
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
   * Processes the options resulting from _showUpgradeDialog()
   * @param {Object} options    The options resulting from _showUpgradeDialog()
   * @param {Function} dropFunc The function to call to complete the drop
   * @private
   */
  async _upgradeSelectedItemOptionHandler(options, dropFunc) {
    for (const [itemId, isSelected] of Object.entries(options)) {
      if (isSelected) {
        const item = this._actor.items.get(itemId);
        this._upgradeItem(item, dropFunc);
        break;
      }
    }
  }

  /**
   * Creates the upgrade for the actor and applies it to the given item
   * @param {Item} item         The item to upgrade
   * @param {Function} dropFunc The function to call to complete the drop
   * @private
   */
  async _upgradeItem(item, dropFunc) {
    if (item) {
      const newUpgradeList = await dropFunc();
      const newUpgrade = newUpgradeList[0];
      const itemUpgradeIds = item.system.upgradeIds;
      itemUpgradeIds.push(newUpgrade._id);
      await item.update({ ["system.upgradeIds"]: itemUpgradeIds });
    }
  }
}
