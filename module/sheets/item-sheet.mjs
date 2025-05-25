import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";
import { setEntryAndAddItem } from "../sheet-handlers/attachment-handler.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class Essence20ItemSheet extends foundry.appv1.sheets.ItemSheet {

  /** @override */
  async activateEditor(name, options={}, initialContent="") {
    options.relativeLinks = true;
    options.plugins = {
      menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
        compact: true,
        destroyOnSave: true,
        onSave: () => {
          this.saveEditor(name, { remove: true });
          this.editingDescriptionTarget = null;
        },
      }),
    };
    return super.activateEditor(name, options, initialContent);
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
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
    const context = await super.getData();

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
    context.system.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.description);
    context.flags = itemData.flags;
    context.roles = await _getVersionRoles(itemData);

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
    // Delete Effects from Weapons
    html.find('.weaponEffect-delete').click(this._onObjectDelete.bind(this, ".weaponEffect"));

    // Delete Faction from Role
    html.find('.faction-delete').click(this._onObjectDelete.bind(this, ".faction"));

    // Delete Origin Upgrade from item
    html.find('.upgrade-delete').click(this._onObjectDelete.bind(this, ".upgrade"));

    // Delete Hang Up from Influence
    html.find('.hangUp-delete').click(this._onObjectDelete.bind(this, ".hangUp"));

    //Delete a Perk off an item
    html.find('.perk-delete').click(this._onObjectDelete.bind(this, ".perk"));

    // Delete Role from Focus
    html.find('.role-delete').click(this._onObjectDelete.bind(this, ".role"));

    // Delete Role Points from Role
    html.find('.rolePoints-delete').click(this._onObjectDelete.bind(this, ".rolePoints"));

    //Delete AltMode From Origin
    html.find('.altMode-delete').click(this._onObjectDelete.bind(this, ".altMode"));

    //Delete Armor from Equipment Packages
    html.find('.armor-delete').click(this._onObjectDelete.bind(this, ".armor"));

    //Delete Shield from Equipment Packages
    html.find('.shield-delete').click(this._onObjectDelete.bind(this, ".shield"));

    //Delete Weapons from Equipment Packages
    html.find('.weapon-delete').click(this._onObjectDelete.bind(this, ".weapon"));

    //Delete Gear from Equipment Packages
    html.find('.gear-delete').click(this._onObjectDelete.bind(this, ".gear"));

    //Open Attached Item Sheet
    html.find('.view-info').click(this._onObjectInfo.bind(this));

    //Copy to clipboard
    html.find('.clipboard-copy').click(this._onCopyClipboard.bind(this));
  }

  /**
  * Handles the dropping of items on to other items
  * @param {DragEvent} event The concluding DragEvent which contains drop data
  * @private
  */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const droppedItem = await fromUuid(data.uuid);
    const targetItem = this.item;
    await setEntryAndAddItem(droppedItem, targetItem);
    const newData = await fromUuid(targetItem.uuid);

    this.object.system = newData.system;
    this.render(true);
  }

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
    const newData = await fromUuid(this.item.uuid);

    this.object.system = newData.system;
    li.slideUp(200, () => this.render(false));
  }

  /**
   * Handles opening the item sheet of an attached item from the info button
   * @param {Event} data The data from the click event
   */
  async _onObjectInfo(data) {
    const item = await fromUuid(data.currentTarget.dataset.uuid);
    if (item) {
      item.sheet.render(true);
    }
  }

  /**
   * Handles copying data to the clipboard
   * @param {Event} data The data from the click event
   */
  _onCopyClipboard(data) {
    const clipText = data.currentTarget.dataset.clipboard;
    if (clipText) {
      game.clipboard.copyPlainText(clipText);
      ui.notifications.info(game.i18n.format("E20.ClipboardCopy", { clipText }));
    }
  }
}

/**
 * Handles retrieving all existing roles of the system version selected.
 * @param {ItemData} itemData The data of the item that is being opened.
 * @returns versionRoles the roles of the system version that is selected.
 */
async function _getVersionRoles(itemData) {
  const versionRoles = {};
  for (const pack of game.packs) {
    const selection = await pack.getDocuments({ type: "role" });
    for (const role of selection) {
      if (role.system.version == itemData.system.version){
        versionRoles[role.name] = {
          type: role.type,
        };
      }
    }
  }

  const worldItems = game.items;
  for (const worldItem of worldItems) {
    if (worldItem.type == "role") {
      if (worldItem.system.version == itemData.system.version) {
        versionRoles[worldItem.name] = {
          type: worldItem.type,
        };
      }
    }
  }

  return versionRoles;
}
