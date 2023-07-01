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
   * Creates dialog window for Crossover Options
   * @param {Item} item         The item to upgrade
   * @param {Function} dropFunc The function to call to complete the drop
   */
  async upgradeItem(item, dropFunc) {
    const upgradeType = item.system.type;
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
      ui.notifications.error(game.i18n.localize('E20.NoItemsError'));
      return false;
    }
  }

  /**
   * Creates dialog window for Crossover Options
   * @param {Object} options    The options resulting from _showUpgradeDialog()
   * @param {Function} dropFunc The function to call to complete the drop
   * @private
   */
  async _upgradeSelectedItemOptionHandler(options, dropFunc) {
    for (const [itemId, isSelected] of Object.entries(options)) {
      if (isSelected) {
        const item = this._actor.items.get(itemId);
        this._upgradeItem(item, dropFunc);
      }
    }
  }

  /**
   * Creates dialog window for Crossover Options
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
