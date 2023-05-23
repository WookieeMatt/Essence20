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
    if (context.item.type == 'origin') {
      this._prepareItemDisplay(context, "originPerk");
    }

    if (context.item.type == 'armor' || context.item.type =='weapon') {
      this._prepareItemDisplay(context, "upgrade");
    }
    if (context.item.type == 'influence') {
      this._prepareItemDisplay(context, "hangUp");
      this._prepareItemDisplay(context, "influencePerk");
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
    console.log(context)
    return context;
  }

  /**
  * Retireves the attached items for display on the sheet
  * @param {Object} context   The information from the item
  * @private
  */
  async _prepareItemDisplay(context, itemType) {
    let itemArray = [];
    for (let itemId of (this.item.system[`${itemType}Ids`])) {
      const item = game.items.get(itemId);
      if (item){
        itemArray.push(item);
      }
    }

    if (!itemArray.length) {
      for (let itemId of (this.item.system[`${itemType}Ids`])) {
        const item = await this._searchCompendium(itemId);
        console.log(item)
        itemArray.push(item);
        console.log(itemArray);
      }
    }
      console.log(itemArray);
      context[`${itemType}s`] = itemArray;
      console.log(itemType)
      console.log(context[`${itemType}s`])
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

    // Delete Origin Perks from Origns
    html.find('.influencePerk-delete').click(this._onInfluencePerkDelete.bind(this));

    // Delete Origin Perks from Origns
    html.find('.hangUp-delete').click(this._onHangUpDelete.bind(this));

  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const targetItem = this.item;

    let droppedItem = indexFromUuid(data.uuid);
    if (!droppedItem.system) {
      droppedItem = await this._searchCompendium(droppedItem);
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
        if (droppedItem.system.type == "weapon") {
          const upgradeIds = duplicate(this.item.system.upgradeIds);

          this._addItemIfUnique(droppedItem, data, upgradeIds, "upgrade");
          this._addDroppedUpgradeTraits(droppedItem);
        }
      }
    } else if (targetItem.type == "influence") {
      if (droppedItem.type == "perk") {
        const influencePerkIds = duplicate(this.item.system.influencePerkIds);

        this._addItemIfUnique(droppedItem, data, influencePerkIds, "influencePerk");
      } else if (droppedItem.type == "hangUp") {
        const hangUpIds = duplicate(this.item.system.hangUpIds);

        this._addItemIfUnique(droppedItem, data, hangUpIds, "hangUp");
      }
    }
    this.render(true);
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
  * Handles search of the Compendiums to find the item
  * @param {Item|String} item  Either an ID or an Item to find in the compendium
  * @returns {Item|String}     The Item if found, or the item param otherwise
  * @private
  */
  async _searchCompendium(item) {
    const id = item._id || item;

    for (const pack of game.packs){
      const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
      if (compendium) {
        const compendiumItem = await compendium.getDocument(id);
        if (compendiumItem) {
          console.log(compendiumItem)
          item = compendiumItem;
        }
      }
    }

    return item
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
  * Handle deleting of a Perk from an Influence Sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onInfluencePerkDelete(event) {
    const li = $(event.currentTarget).parents(".influencePerk");
    console.log(li)
    const influencePerkId = li.data("influenceperkId");
    console.log(influencePerkId)
    let influencePerkIds = this.item.system.influencePerkIds.filter(x => x !== influencePerkId);
    this.item.update({
      "system.influencePerkIds": influencePerkIds,
    });
    li.slideUp(200, () => this.render(false));
  }

  /**
  * Handle deleting of a Perk from an Influence Sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  async _onHangUpDelete(event) {
    const li = $(event.currentTarget).parents(".hangUp");
    const hangUpId = li.data("hangupId");
    let hangUpIds = this.item.system.hangUpIds.filter(x => x !== hangUpId);
    this.item.update({
      "system.hangUpIds": hangUpIds,
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

    const deletedUpgrade = game.items.get(upgradeId) || await this._searchCompendium(upgradeId);
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
              const otherItem = game.items.get(id);
              if (!otherItem) {
                otherItem = await this._searchCompendium(id);
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
      const defenseName = deletedUpgrade.system.armorBonus.defense.charAt(0).toUpperCase() + deletedUpgrade.system.armorBonus.defense.slice(1)
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
