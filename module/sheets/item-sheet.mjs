import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";

/**
* Handle deleting of an Origin from an Actor Sheet
* @param {Object} uuid   The uuid of an item
* @returns {Object>} index The id of the item
* @private
*/
function indexFromUuid(uuid) {
  const parts = uuid.split(".");
  let index;

  // Compendium Documents
  if ( parts[0] === "Compendium" ) {
    const [, scope, packName, id] = parts;
    const pack = game.packs.get(`${scope}.${packName}`);
    index = pack?.index.get(id);
  }

  // World Documents
  else if ( parts.length < 3 ) {
    const [docName, id] = parts;
    const collection = CONFIG[docName].collection.instance;
    index = collection.get(id);
  }

  return index || null;
}

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
    const path = "systems/essence20/templates/item";
    // Return a unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
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
    context.system.description = TextEditor.enrichHTML(itemData.system.description);
    context.flags = itemData.flags;

    return context;
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
          if (compendium.index) {
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
  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event            The concluding DragEvent which contains drop data
  * @private
  */
  //
  async _onDrop (event) {
    const data = TextEditor.getDragEventData(event);
    const droppedItem = indexFromUuid(data.uuid);
    const parts = data.uuid.split(".");
    const targetItem = this.item;

    if (targetItem.type  == "origin") {
      if (droppedItem.type == "perk") {
        const originPerkIds = duplicate(this.item.system.originPerkIds);

        // Can't contain duplicate Origin Perks
        if (parts[0] === "Compendium") {
          if (!originPerkIds.includes(droppedItem._id)) {
            originPerkIds.push(droppedItem._id);
            await this.item.update({
              "system.originPerkIds": originPerkIds
            }).then(this.render(false));
          }
        } else if (!originPerkIds.includes(droppedItem.id)) {
            originPerkIds.push(droppedItem.id);
            await this.item.update({
              "system.originPerkIds": originPerkIds
            }).then(this.render(false));
        }
      }
    }
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
}
