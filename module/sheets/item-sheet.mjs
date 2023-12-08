import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";
import { setEntryAndAddItem } from "../helpers/utils.mjs";

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
    html.find('.originPerk-delete').click(this._onObjectDelete.bind(this, ".perk"));

    // Delete Effects from Weapons
    html.find('.weaponEffect-delete').click(this._onObjectDelete.bind(this, ".weaponEffect"));

    // Delete Origin Upgrade from item
    html.find('.upgrade-delete').click(this._onObjectDelete.bind(this, ".upgrade"));

    // Delete Influence Perk from Influence
    html.find('.influencePerk-delete').click(this._onObjectDelete.bind(this, ".perk"));

    // Delete Hang Up from Influence
    html.find('.hangUp-delete').click(this._onObjectDelete.bind(this, ".hangUp"));
  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event The concluding DragEvent which contains drop data
  * @private
  */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const droppedItem = await fromUuid(data.uuid);
    const targetItem = this.item;
    await setEntryAndAddItem(droppedItem, targetItem);

    this.render(true);
  }

  /**
  * Handle adding Traits to Items from a dropped Upgrade
  * @param {Upgrade} upgrade  The upgrade that was dropped
  * @private
  */
  // async _addDroppedUpgradeTraits(upgrade) {
  //   if (upgrade.system.traits.length > 0) {
  //     const itemTraits = this.item.system.traits;
  //     const itemUpgradeTraits = this.item.system.upgradeTraits;

  //     for (const droppedTrait of upgrade.system.traits) {
  //       if (!itemTraits.includes(droppedTrait) && !itemUpgradeTraits.includes(droppedTrait)) {
  //         itemUpgradeTraits.push(droppedTrait);
  //       }
  //     }

  //     await this.item.update({
  //       "system.upgradeTraits": itemUpgradeTraits,
  //     }).then(this.render(false));
  //   }
  // }

  /**
  * Handle deleting of a Ids from an item Sheet
  * @param {String} cssClass           Where the deleted item is on the sheet
  * @param {DeleteEvent} event         The concluding DragEvent which contains drop data
  * @private
  */
  async _onObjectDelete(cssClass, event) {
    const li = $(event.currentTarget).parents(cssClass);
    const id = li.data("itemKey");
    const updateString = `system.items.-=${id}`;

    await this.item.update({[updateString]: null});

    li.slideUp(200, () => this.render(false));
  }

  /**
  * Handle deleting of an Upgrade from an Item sheet
  * @param {DeleteEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  // async _onUpgradeDelete(event) {
  //   const li = $(event.currentTarget).parents(".upgrade");
  //   const upgradeId = li.data("itemKey");

  //   if (this.item.system.items[upgradeId].traits.length>0) {
  //     let keptTraits = this.item.system.upgradeTraits;
  //     const upgradeIds = this.item.system.upgradeIds;

  //     for (const deletedUpgradeTrait of deletedUpgrade.system.traits) {
  //       let isOtherItemTrait = false;

  //       if (keptTraits.includes(deletedUpgradeTrait)) {
  //         for (const id of upgradeIds) {
  //           if (upgradeId != id) {
  //             let otherItem = game.items.get(id);
  //             if (!otherItem) {
  //               otherItem = await searchCompendium(id);
  //             }

  //             if (otherItem.system.traits.includes(deletedUpgradeTrait)) {
  //               isOtherItemTrait = true;
  //               break;
  //             }
  //           }
  //         }
  //       }

  //       if (!isOtherItemTrait) {
  //         keptTraits = keptTraits.filter(x => x !== deletedUpgradeTrait);
  //       }
  //     }

  //     await this.item.update({
  //       "system.upgradeTraits": keptTraits,
  //     }).then(this.render(false));
  //   }

  //   if (deletedUpgrade.system.armorBonus.value > 0) {
  //     const defenseName = deletedUpgrade.system.armorBonus.defense.charAt(0).toUpperCase() + deletedUpgrade.system.armorBonus.defense.slice(1);
  //     const armorString = `system.bonus${defenseName}`;
  //     const defense = this.item.system[`bonus${defenseName}`] -= deletedUpgrade.system.armorBonus.value;
  //     await this.item.update({
  //       [armorString]: defense,
  //     }).then(this.render(false));
  //   }

  //   let upgradeIds = this.item.system.upgradeIds.filter(x => x !== upgradeId);
  //   this.item.update({
  //     "system.upgradeIds": upgradeIds,
  //   });
  //   li.slideUp(200, () => this.render(false));
  // }
}
