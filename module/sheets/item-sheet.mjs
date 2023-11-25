import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";
import { indexFromUuid, randomId, searchCompendium } from "../helpers/utils.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class Essence20ItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["essence20", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
    });
  }

  /** @override */
  get template() {
    const path = "systems/essence20/templates/item/sheets";
    // Return a unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/${this.item.type}.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Make all the Essence20 consts accessible
    context.config = CONFIG.E20;

    // Use a safe clone of the item data for further operations.
    const itemData = context.item;

    const itemType = context.item.type;
    if (itemType == 'origin') {
      await this._prepareItemDisplay(context, "originPerk");
    } else if (itemType == 'armor') {
      await this._prepareItemDisplay(context, "upgrade");
    } else if (itemType == 'weapon') {
      await this._prepareItemDisplay(context, "upgrade");
      await this._prepareItemDisplay(context, "weaponEffect");
    } else if (itemType == 'influence') {
      await this._prepareItemDisplay(context, "hangUp");
      await this._prepareItemDisplay(context, "perk");
    }

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.object.effects);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.system.description = TextEditor.enrichHTML(itemData.system.description, {async: false});
    context.flags = itemData.flags;

    return context;
  }

  /**
  * Retireves the attached items for display on the sheet
  * @param {Object} context   The information from the item
  * @param {string} itemType  The type of items to prepare
  * @private
  */
  async _prepareItemDisplay(context, itemType) {
    const itemArray = [];
    for (let itemId of (this.item.system[`${itemType}Ids`])) {
      const item = await searchCompendium(itemId) ||  game.items.get(itemId) || this.actor.items.get(itemId);
      if (item) {
        itemArray.push(item);
      }
    }

    context[`${itemType}s`] = itemArray;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;
    html.find(".effect-control").click(ev => {
      if (this.item.isOwned) return ui.notifications.warn("Managing Active Effects within an Owned Item is not currently supported and will be added in a subsequent update.");
      onManageActiveEffect(ev, this.item);
    });

    html.find(".trait-selector").click(ev => {
      onManageSelectTrait(ev, this.item);
    });

    this.form.ondrop = (event) => this._onDrop(event);

    // Delete Origin Perks from Origns
    html.find('.originPerk-delete').click(this._onIdDelete.bind(this, ".perk", "originPerkIds"));

    // Delete Effects from Weapons
    html.find('.weaponEffect-delete').click(this._onIdDelete.bind(this, ".weaponEffect", "weaponEffectIds"));

    // Delete Origin Upgrade from item
    html.find('.upgrade-delete').click(this._onUpgradeDelete.bind(this));

    // Delete Influence Perk from Influence
    html.find('.influencePerk-delete').click(this._onIdDelete.bind(this, ".perk", "perkIds"));

    // Delete Hang Up from Influence
    html.find('.hangUp-delete').click(this._onIdDelete.bind(this, ".hangUp", "hangUpIds"));

     // Delete Role Perk from Influence
     html.find('.rolePerk-delete').click(this._onObjectDelete.bind(this, ".perk"));

     //Role Level Sort
     html.find('.level').change(this._onItemSort.bind(this));
  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event The concluding DragEvent which contains drop data
  * @private
  */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const targetItem = this.item;

    let droppedItem = indexFromUuid(data.uuid);
    if (!droppedItem.system) {
      droppedItem = await searchCompendium(droppedItem);
    }

    if (targetItem.type  == "origin") {
      if (droppedItem.type == "perk") {
        const originPerkIds = duplicate(this.item.system.originPerkIds);
        this._addItemIfUnique(droppedItem, data, originPerkIds, "originPerk");
      }
    } else if (targetItem.type == "armor") {
      if (droppedItem.type == "upgrade") {
        if (droppedItem.system.type == "armor") {
          const upgradeIds = duplicate(this.item.system.upgradeIds);

          this._addItemIfUnique(droppedItem, data, upgradeIds, "upgrade");
          this._addDroppedUpgradeTraits(droppedItem);

          if (droppedItem.system.armorBonus.value > 0) {
            const defenseName = droppedItem.system.armorBonus.defense.charAt(0).toUpperCase() + droppedItem.system.armorBonus.defense.slice(1);
            const armorString = `system.bonus${defenseName}`;
            const defense = targetItem.system[`bonus${defenseName}`] += droppedItem.system.armorBonus.value;
            await this.item.update({
              [armorString]: defense,
            }).then(this.render(false));
          }
        }
      }
    } else if (targetItem.type == "weapon") {
      if (droppedItem.type == "upgrade") {
        if (droppedItem.system.type == "weapon") {
          const upgradeIds = duplicate(this.item.system.upgradeIds);
          this._addItemIfUnique(droppedItem, data, upgradeIds, "upgrade");
          this._addDroppedUpgradeTraits(droppedItem);
        }
      } else if (droppedItem.type == "weaponEffect") {
        const weaponEffectIds = duplicate(this.item.system.weaponEffectIds);
        this._addItemIfUnique(droppedItem, data, weaponEffectIds, "weaponEffect");
      }
    } else if (targetItem.type == "influence") {
      if (droppedItem.type == "perk") {
        const perkIds = duplicate(this.item.system.perkIds);
        this._addItemIfUnique(droppedItem, data, perkIds, "perk");
      } else if (droppedItem.type == "hangUp") {
        const hangUpIds = duplicate(this.item.system.hangUpIds);
        this._addItemIfUnique(droppedItem, data, hangUpIds, "hangUp");
      }
    } else if (targetItem.type == "role" || targetItem.type == "focus") {
      if (droppedItem.type == "perk") {

        const entry = {
          uuid: droppedItem.uuid,
          img: droppedItem.img,
          name: droppedItem.name,
          subtype: droppedItem.system.type,
          type: droppedItem.type,
          level: 1,
      };
        const items = targetItem.system.items;
        const pathPrefix = "system.items";

        let id= "";
        do {
            id = randomID(5);
        } while (items[id]);

        await this.item.update({
          [`${pathPrefix}.${id}`]: entry,
        })
      }
    }

    this.render(true);
    this._onItemSort();
  }

  /**
  * Handles validating an item being dropped is unique
  * @param {Item} droppedItem The item that was dropped
  * @param {Object} data The data from drop event
  * @param {Array} existingIds  The Ids of existing items attached to the target item
  * @param {String} itemType  A string defining what the item is
  * @private
  */
  async _addItemIfUnique(droppedItem, data, existingIds, itemType) {
    const uuidParts = data.uuid.split(".");
    const idString = `system.${itemType}Ids`;

    if (uuidParts[0] === "Compendium") {
      if (!existingIds.includes(droppedItem._id)) {
        existingIds.push(droppedItem._id);
        await this.item.update({
          [idString]: existingIds,
        }).then(this.render(false));
      }
    } else if (!existingIds.includes(droppedItem.id)) {
      existingIds.push(droppedItem.id);
      await this.item.update({
        [idString]: existingIds,
      }).then(this.render(false));
    }
  }

  /**
  * Handle adding Traits to Items from a dropped Upgrade
  * @param {Upgrade} upgrade  The upgrade that was dropped
  * @private
  */
  async _addDroppedUpgradeTraits(upgrade) {
    if (upgrade.system.traits.length > 0) {
      const itemTraits = this.item.system.traits;
      const itemUpgradeTraits = this.item.system.upgradeTraits;

      for (const droppedTrait of upgrade.system.traits) {
        if (!itemTraits.includes(droppedTrait) && !itemUpgradeTraits.includes(droppedTrait)) {
          itemUpgradeTraits.push(droppedTrait);
        }
      }

      await this.item.update({
        "system.upgradeTraits": itemUpgradeTraits,
      }).then(this.render(false));
    }
  }

  /**
  * Handle deleting of a Ids from an item Sheet
  * @param {String} cssClass           Where the deleted item is on the sheet
  * @param {String} itemListName       The name of the ID list
  * @param {DeleteEvent} event         The concluding DragEvent which contains drop data
  * @private
  */
  async _onIdDelete(cssClass, itemListName, event) {
    const li = $(event.currentTarget).parents(cssClass);
    const id = li.data("itemId");
    const ids = this.item.system[itemListName].filter(x => x !== id);
    const systemSearch = `system.${itemListName}`;
    this.item.update({
      [systemSearch]: ids,
    });
    li.slideUp(200, () => this.render(false));
  }

  async _onObjectDelete(cssClass, event) {
    console.log(cssClass)
    const li = $(event.currentTarget).parents(cssClass);
    const id = li.data("itemKey");
    const updateString = `system.items.-=${id}`

    await this.item.update({[updateString]: null});

    li.slideUp(200, () => this.render(false));
  }

  _onItemSort(event) {
    console.log(event)
    let toSort = document.getElementById('rolePerkList').children
    toSort = Array.prototype.slice.call(toSort, 0);
    console.log(toSort)
    toSort.sort(function(a, b) {

      let aord = parseInt( $(a).data("itemLevel"));
      let bord = parseInt( $(b).data("itemLevel"));
      // two elements never have the same ID hence this is sufficient:
      return (aord < bord) ? -1 : (aord > bord) ? 1 : 0;
    })


    let parent = document.getElementById('rolePerkList');
    parent.innerHTML = "";

    for(let i = 0; i < toSort.length; i++) {
      parent.appendChild(toSort[i]);
    }
    document.getElementById('rolePerkList').innerHTML = parent.innerHTML;
  }

  /**
  * Handle deleting of an Upgrade from an Item sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onUpgradeDelete(event) {
    const li = $(event.currentTarget).parents(".upgrade");
    const upgradeId = li.data("itemId");

    const deletedUpgrade = game.items.get(upgradeId) || await searchCompendium(upgradeId);
    if (!deletedUpgrade) {
      return;
    }

    if (deletedUpgrade.system.traits.length > 0) {
      let keptTraits = this.item.system.upgradeTraits;
      const upgradeIds = this.item.system.upgradeIds;

      for (const deletedUpgradeTrait of deletedUpgrade.system.traits) {
        let isOtherItemTrait = false;

        if (keptTraits.includes(deletedUpgradeTrait)) {
          for (const id of upgradeIds) {
            if (upgradeId != id) {
              let otherItem = game.items.get(id);
              if (!otherItem) {
                otherItem = await searchCompendium(id);
              }

              if (otherItem.system.traits.includes(deletedUpgradeTrait)) {
                isOtherItemTrait = true;
                break;
              }
            }
          }
        }

        if (!isOtherItemTrait) {
          keptTraits = keptTraits.filter(x => x !== deletedUpgradeTrait);
        }
      }

      await this.item.update({
        "system.upgradeTraits": keptTraits,
      }).then(this.render(false));
    }

    if (deletedUpgrade.system.armorBonus.value > 0) {
      const defenseName = deletedUpgrade.system.armorBonus.defense.charAt(0).toUpperCase() + deletedUpgrade.system.armorBonus.defense.slice(1);
      const armorString = `system.bonus${defenseName}`;
      const defense = this.item.system[`bonus${defenseName}`] -= deletedUpgrade.system.armorBonus.value;
      await this.item.update({
        [armorString]: defense,
      }).then(this.render(false));
    }

    let upgradeIds = this.item.system.upgradeIds.filter(x => x !== upgradeId);
    this.item.update({
      "system.upgradeIds": upgradeIds,
    });
    li.slideUp(200, () => this.render(false));
  }
}
