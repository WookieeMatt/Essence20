import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";
import { indexFromUuid } from "../helpers/utils.mjs";

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
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
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
  getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Make all the Essence20 consts accessible
    context.config = CONFIG.E20;

    // Use a safe clone of the item data for further operations.
    const itemData = context.item;
    this._prepareOriginPerks(context);

    this._prepareUpgrades(context);

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
  * Retireves the attached Upgrades for display on the sheet
  * @param {Object} context   The information from the item
  * @private
  */
  _prepareUpgrades(context) {
    if (['armor', 'weapon'].includes(this.item.type)) {
      let upgrades = [];
      for (let upgradeId of this.item.system.upgradeIds) {
        const upgrade = game.items.get(upgradeId);
        if (upgrade){
          upgrades.push(upgrade);
        }
      }

      if (!upgrades.length) {
        for (let pack of game.packs){
          const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
          if (compendium) {
            let upgrade = compendium.index.get(this.item.system.upgradeIds[0]);
            if (upgrade) {
              upgrades.push(upgrade);
            }
          }
        }
      }

      context.upgrades = upgrades;
    }
  }

  /**
  * Retireves the attached Origin Perks for display on the sheet
  * @param {Object} context   The information from the item
  * @private
  */
  _prepareOriginPerks(context) {
    if (this.item.type == 'origin') {
      let originPerks = [];
      for (let originPerkId of this.item.system.originPerkIds) {
        const originPerk = game.items.get(originPerkId);
        if (originPerk){
          originPerks.push(originPerk);
        }
      }

      if (!originPerks.length) {
        for (let pack of game.packs){
          const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
          if (compendium) {
            let originPerk = compendium.index.get(this.item.system.originPerkIds[0]);
            if (originPerk) {
              originPerks.push(originPerk);
            }
          }
        }
      }

      context.originPerks = originPerks;
    }
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
    html.find('.originPerk-delete').click(this._onOriginPerkDelete.bind(this));

    // Delete Origin Perks from Origns
    html.find('.upgrade-delete').click(this._onUpgradeDelete.bind(this));
  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  //
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    let droppedItem = indexFromUuid(data.uuid);
    const targetItem = this.item;

    if (targetItem.type  == "origin") {
      if (droppedItem.type == "perk") {
        const originPerkIds = duplicate(this.item.system.originPerkIds);

        this._addIfUnique(data, originPerkIds, droppedItem, "originPerk");
      }
    } else if (targetItem.type == "armor") {
      if (droppedItem.type == "upgrade") {
        if(!droppedItem.system) {
          droppedItem = await this._searchCompendium(droppedItem);
        }
        if (droppedItem.system.type == "armor") {
          const upgradeIds = duplicate(this.item.system.upgradeIds);

          this._addIfUnique (data, upgradeIds, droppedItem, "upgrade");

          this._addDroppedUpgradeTraits (droppedItem, targetItem);

          if (droppedItem.system.armorBonus.value >0) {
            const defenseName = droppedItem.system.armorBonus.defense.charAt(0).toUpperCase() + droppedItem.system.armorBonus.defense.slice(1)
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
        if(!droppedItem.system) {
          droppedItem = await this._searchCompendium(droppedItem);
        }
        if (droppedItem.system.type == "weapon") {
          const upgradeIds = duplicate(this.item.system.upgradeIds);

          this._addIfUnique (data, upgradeIds, droppedItem, "upgrade");

          this._addDroppedUpgradeTraits (droppedItem, targetItem);

        }
      }
    }
    this.render(true);
  }

  /**
  * Handles validating an item being dropped is unique
  * @param {Object} data The data from drop event
  * @param {Item} droppedItem The item that was dropped
  * @param {String} itemType  A string defining what the item is
  * @param {Array} existingIds  The Ids of existing items attached to the target item
  * @private
  */
  async _addIfUnique(data, existingIds, droppedItem, itemType) {
    const uuidParts = data.uuid.split(".");
    const idString = `system.${itemType}Ids`;
    if (uuidParts[0] === "Compendium") {
      if (!existingIds.includes(droppedItem._id)) {
        existingIds.push(droppedItem._id);
        await this.item.update({
          [idString]: existingIds
        }).then(this.render(false));
      }
    } else if (!existingIds.includes(droppedItem.id)) {
      existingIds.push(droppedItem.id);
      await this.item.update({
        [idString]: existingIds
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
      let itemTraits = this.item.system.traits;
      let upgradeTraits = this.item.system.upgradeTraits;
      for (let trait of upgrade.system.traits) {
        if (!itemTraits.includes(trait) && !upgradeTraits.includes(trait)) {
          upgradeTraits.push(trait);
        }
      }
      await this.item.update({
        "system.upgradeTraits": upgradeTraits,
      }).then(this.render(false));
    }
  }

  async _searchCompendium(droppedItem) {
    let id = droppedItem._id;
    if (!id) {
      id = droppedItem;
    }
    for (let pack of game.packs){
      const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
      if (compendium) {
        let droppedUpgrade = await compendium.getDocument(id);
        if (droppedUpgrade) {
          droppedItem = droppedUpgrade;
        }
      }
    }
    return droppedItem
  }

  /**
  * Handle deleting of a Perk from an Origin Sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onOriginPerkDelete(event) {
    const li = $(event.currentTarget).parents(".originPerk");
    const originPerkId = li.data("originperkId");
    let originPerkIds = this.item.system.originPerkIds.filter(x => x !== originPerkId);
    this.item.update({
      "system.originPerkIds": originPerkIds,
    });
    li.slideUp(200, () => this.render(false));
  }

  /**
  * Handle deleting of an Upgrade from an Item sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onUpgradeDelete(event) {
    const li = $(event.currentTarget).parents(".upgrade");
    const upgradeId = li.data("upgradeId");
    let data = game.items.get(upgradeId);
    if(!data) {
      data = await this._searchCompendium(upgradeId);
    }
    if (data.system.traits.length > 0) {
      let keptTraits = this.item.system.upgradeTraits;
      const upgradeIds = this.item.system.upgradeIds;

      for (let itemTrait of data.system.traits) {
        let isOtherItemTrait = false;

        if(keptTraits.includes(itemTrait)) {
          for (let id of upgradeIds) {
            if (upgradeId != id){
              let otherItem = game.items.get(id);
              if(!otherItem) {
                for (let pack of game.packs){
                  const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
                  if (compendium) {
                    otherItem = await compendium.getDocument(id);
                  }
                }
              }
              if (otherItem.system.traits.includes(itemTrait)) {
                isOtherItemTrait = true
              }
            }
          }
        }
        if (!isOtherItemTrait) {
          keptTraits = keptTraits.filter(x => x !== itemTrait);
        }
      }
      await this.item.update({
        "system.upgradeTraits": keptTraits,
      }).then(this.render(false));
    }

    if (data.system.armorBonus.value > 0) {
      const defenseName = data.system.armorBonus.defense.charAt(0).toUpperCase() + data.system.armorBonus.defense.slice(1)
      const armorString = `system.bonus${defenseName}`;
      const defense = this.item.system[`bonus${defenseName}`] -= data.system.armorBonus.value;
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
