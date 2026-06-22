const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { onManageSelectTrait } from "../helpers/traits.mjs";
import { updateRoleCache } from "../helpers/utils.mjs";
import { setEntryAndAddItem } from "../sheet-handlers/attachment-handler.mjs";

/**
 * Handles retrieving all existing roles of the system version selected.
 * @param {ItemData} itemData The data of the item that is being opened.
 * @returns versionRoles the roles of the system version that is selected.
 */
async function _getVersionRoles(itemData) {
  const versionRoles = {};

  // Should be generated on world load, but just in case
  if (CONFIG.E20.allPackRoles == null) {
    await updateRoleCache();
  }

  for (const role of CONFIG.E20.allPackRoles) {
    if (role.system.version == itemData.system.version){
      versionRoles[role.name] = {
        type: role.type,
      };
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

/**
* Handles opening the item sheet of an attached item from the info button
* @param {Event} data The data from the click event
*/
async function _onObjectInfo(target) {
  const item = await fromUuid(target.dataset.uuid);
  if (item) {
    item.sheet.render(true);
  }
}

/**
* Handle deleting of a Ids from an item Sheet
* @param {String} cssClass           Where the deleted item is on the sheet
* @param {DeleteEvent} event         The concluding DragEvent which contains drop data
* @private
*/
async function _onObjectDelete(data, item) {
  const id = data.itemKey;
  const updateString = `system.items.${id}`;
  await item.document.update({
    [updateString]: new foundry.data.operators.ForcedDeletion(),
  });
}

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class Essence20ItemSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      deleteItem: this.#deleteItem,
      traitSelector: this.#traitSelector,
      viewItem: this.#viewItem,
      editDescription: this.#editDescription,
    },
    classes: ["essence20", "sheet", "item", "window-app", "sheet-header"],
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: "auto",
      height: "auto",
    },
    tag: 'form',
    window: {
      resizable: true,
    }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "description", group: 'primary', label: "Description"},
        { id: "details", group: 'primary', label: "Details"},
        { id: "effects", group: 'primary', label: "Effects"},
      ],
      initial: "description",
    },
  };

  tabGroups = {
    primary: "description"
  };

  /** @override */
  static PARTS = {
    header: {
      template: "systems/essence20/templates/item/parts/header.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    description: {
      template: "systems/essence20/templates/item/parts/description.hbs",
      scrollable: [""],
    },
    details: {
      template: "systems/essence20/templates/item/parts/item-base.hbs",
      scrollable: [""],
    },
    effects: {
      template: "systems/essence20/templates/item/parts/active-effects.hbs",
      scrollable: [""],
    },
  };


  editingDescriptionTarget = null;
  /* -------------------------------------------- */
  /** @override */
  async _prepareContext(options) {
    console.log(options)
    // Retrieve base data structure.
    const context = await super._prepareContext(options);

    // Make all the Essence20 consts accessible
    context.config = CONFIG.E20;

    // Use a safe clone of the item data for further operations.
    const itemData = context.document;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    if (options.isFirstRender) {
      context.activeTab = "description";
    }

    for (const [key, tab] of Object.entries(context.tabs)){
      if (tab.active){
        context.activeTab = key;
      }
    }

    // Prepare active effects
    // context.effects = prepareActiveEffectCategories(this.object.effects);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.system.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.description);
    context.flags = itemData.flags;

    if (this.document.type == 'perk') {
      context.roles = await _getVersionRoles(itemData);
    }

    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    switch ( partId ) {
    case "description": context = await this._prepareDescriptionContext(context); break;
    case "details": context = await this._prepareDetailsContext(context); break;
    case "effects": context = await this._prepareEffectsContext(context); break;
    }

    return context;
  }

  async _prepareDescriptionContext(context) {
    if (this.editingDescriptionTarget) {
      context.editingDescription = {
        target: this.editingDescriptionTarget,
        value: foundry.utils.getProperty(this.document._source, this.editingDescriptionTarget),
      };
    }

    return context;
  }

  async _prepareDetailsContext(context) {
    return context;
  }

  async _prepareEffectsContext(context) {
    return context;
  }

  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const droppedItem = await fromUuid(data.uuid);
    const targetItem = this.document;
    await setEntryAndAddItem(droppedItem, targetItem);
  }

  async _onRender(context, options) {
    console.log(context)
    await super._onRender(context, options);
    new CONFIG.ux.DragDrop({
      dragSelector: ":is([data-activity-id], [data-effect-id], [data-item-id])",
      dropSelector: null,
      callbacks: {
        drop: this._onDrop.bind(this),
      },
    }).bind(this.element);

    if ( this.editingDescriptionTarget ) {
      this.element.querySelectorAll("prose-mirror").forEach(editor => editor.addEventListener("save", () => {
        this.editingDescriptionTarget = null;
        this.render();
      }));
    }
  }

  /* -------------------------------------------- */
  static async #deleteItem(event,target) {
    _onObjectDelete(target.dataset,this);
  }

  static async #traitSelector(event, target) {
    onManageSelectTrait(event, this.document, target);
  }

  static async #viewItem(event,target){
    _onObjectInfo(target);
  }

  static #editDescription(event, target) {
    this.editingDescriptionTarget = target.dataset.target;
    this.render();
  }
}
