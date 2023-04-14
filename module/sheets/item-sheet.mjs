import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";

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

    this._preparePerks(context);

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
    context.flags = itemData.flags;

    return context;
  }


  _preparePerks(context) {
    if (this.item.type == 'origin') {
      let originPerkIds = [];

      for (let originPerkId of this.item.system.originPerkIds) {
        originPerkIds.push(game.items.get(originPerkId));
      }
      context.originPerkIds = originPerkIds;
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

  async _onDrop (event) {
    const data = TextEditor.getDragEventData(event);
    const droppedItem = fromUuidSync(data.uuid);
    const targetItem = this.item;
    if (targetItem.type  == "origin") {
      if (droppedItem.type == "perk"){
        const originPerkIds = duplicate(this.item.system.originPerkIds);

      // Can't contain duplicate Origin Perks
      if (!originPerkIds.includes(droppedItem.id)) {
        originPerkIds.push(droppedItem.id);
        await this.item.update({
          "system.originPerkIds": originPerkIds
        }).then(this.render(false));
      }
      } else {
        return
      }
    } else {
      return;
    }
  }

  async _onOriginPerkDelete(event) {
    console.log(event.currentTarget);
    const li = $(event.currentTarget).parents(".originPerk");
    console.log(li);
    const originPerkId = li.data("originPerkId");
    console.log(originPerkId);
    let originPerkIds = this.item.system.originPerkIds.filter(x => x !== originPerkId);
    console.log(originPerkIds);
    this.item.update({
      "system.originPerkIds": [],
    });
    li.slideUp(200, () => this.render(false));
  }
}


