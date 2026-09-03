const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ContextMenu } = foundry.applications.ux;

import { applyThemeClass } from "../settings.js";
import { serializeFormSubmits } from "../apps/serialize-form-submits.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";
import { updateRoleCache } from "../helpers/utils.mjs";
import { setEntryAndAddItem } from "../sheet-handlers/attachment-handler.mjs";
import {
  prepareActiveEffectCategories,
  onCreateActiveEffect,
  onDeleteActiveEffect,
  onDropActiveEffect,
  onEditActiveEffect,
  onToggleActiveEffect,
} from "../helpers/effects.mjs";

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
export class Essence20ItemSheet extends serializeFormSubmits(HandlebarsApplicationMixin(DocumentSheetV2)) {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      deleteItem: this.#deleteItem,
      traitSelector: this.#traitSelector,
      viewItem: this.#viewItem,
      editDescription: this.#editDescription,
      createEffect: this.#createActiveEffect,
      deleteEffect: this.#deleteActiveEffect,
      editEffect: this.#editActiveEffect,
      toggleEffect: this.#toggleActiveEffect,
    },
    classes: ["essence20", "sheet", "item", "window-app", "theme-wrapper"],
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    /* width: "auto" (the previous value for every item type) sizes the window to fit its
       widest natural content, unconstrained - which for the Description tab meant a long,
       unwrapped run of text (no width to wrap against yet, since auto-sizing measures content
       BEFORE settling on a width) could stretch the whole sheet arbitrarily wide. A fixed width
       keeps sheets a stable, predictable size regardless of description length; height stays
       auto since only width was the complaint. Role's own Details tab is the one exception -
       it's meant to expand for its own, much larger content (Role Perks, Spectrum Modification
       choices, ...) - see _onFirstRender below, which restores "auto" for that type specifically
       before the sheet's first paint. */
    position: {
      width: 500,
      height: "auto",
    },
    tag: 'form',
    window: {
      resizable: true,
    },
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
    primary: "description",
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
      template: "systems/essence20/templates/item/tabs/description.hbs",
      scrollable: [''],
    },
    details: {
      template: "systems/essence20/templates/item/tabs/detail-base.hbs",
      scrollable: [''],
    },
    effects: {
      template: "systems/essence20/templates/item/tabs/effects.hbs",
      scrollable: [""],
    },
  };


  editingDescriptionTarget = null;
  /* -------------------------------------------- */
  /** @override */
  async _prepareContext(options) {
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
      context.tabs.description.active = true;
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
    const path = "systems/essence20/templates/item/details";
    context.detailPath = `${path}/${this.document.type}.hbs`;
    return context;
  }

  async _prepareEffectsContext(context) {
    context.effects = await prepareActiveEffectCategories(this.document.effects);
    return context;
  }

  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const droppedItem = await fromUuid(data.uuid);
    const targetItem = this.document;
    if (droppedItem.type == "base") {
      onDropActiveEffect(droppedItem, targetItem);
    } else {
      await setEntryAndAddItem(droppedItem, targetItem);
    }
  }

  /**
   * system.reroll.skills (module/data/reroll-schema.mjs) is an ArrayField, but its sheet input
   * (templates/item/details/perk.hbs) is a single free-text field so a Perk like "Survivalist"
   * can list several scoped skills (e.g. "alertness, initiative, survival") without a bespoke
   * multi-select widget. ArrayField#_cast doesn't split strings - passed through unchanged,
   * "alertness, survival" would be cast to the single-element array ["alertness, survival"] and
   * fail its own choices validation - so it's parsed into a real array here, before Foundry's own
   * DocumentSheetV2#_prepareSubmitData validates and submits the form.
   */
  _prepareSubmitData(event, form, formData, updateData) {
    const rawSkills = formData.object["system.reroll.skills"];
    if (typeof rawSkills === "string") {
      formData.object["system.reroll.skills"] = rawSkills
        .split(",")
        .map(skill => skill.trim())
        .filter(Boolean);
    }

    return super._prepareSubmitData(event, form, formData, updateData);
  }

  /**
   * Role is the one item type meant to expand beyond the shared fixed width (DEFAULT_OPTIONS
   * above) - its Details tab shows substantially more content (granted Role Perks, Spectrum
   * Modification choiceGroup pairs, ...) than any other item type's. _onFirstRender (not
   * _onRender, which fires on every re-render, including ones a manual drag-resize should
   * survive) runs once, before the sheet's first paint, so this only ever sets the *initial*
   * size - it doesn't fight a resize the user made afterward.
   */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    if (this.document.type === 'role') {
      this.setPosition({ width: 'auto' });
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    applyThemeClass(this.element);

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

    this._activateImageContextMenu();
  }

  /**
   * Right-click the item's own image to broadcast it to every connected player (the same
   * "Share Image" action available from the header of the image's own popout, minus the extra
   * step of opening that popout first) - GM-only, matching core Foundry's own convention of
   * only ever showing that control to a GM. Built once (guarded via this._imageContextMenu,
   * matching base-actor-sheet.mjs's #_activateRolePointsListeners) since ContextMenu binds one
   * delegated listener to a persistent container (this.element) rather than the image itself,
   * so rebuilding it on every render would stack duplicate listeners.
   */
  _activateImageContextMenu() {
    if (!game.user.isGM || this._imageContextMenu) {
      return;
    }

    this._imageContextMenu = new ContextMenu(this.element, '.item-profile-img', [
      {
        name: 'E20.ShowImageToPlayers',
        icon: '<i class="fas fa-eye"></i>',
        callback: () => {
          game.socket.emit('shareImage', {
            image: this.document.img,
            title: this.document.name,
            uuid: this.document.uuid,
          });
          ui.notifications.info(game.i18n.format('JOURNAL.ActionShowSuccess', { mode: 'image', title: this.document.name, which: 'all' }));
        },
      },
    ], { jQuery: false, fixed: true });
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

  static #createActiveEffect(event) {
    onCreateActiveEffect(event, this.document);
  }

  static #deleteActiveEffect(event){
    onDeleteActiveEffect(event, this.document);
  }

  static #editActiveEffect(event) {
    onEditActiveEffect(event, this.document);
  }

  static #toggleActiveEffect(event){
    onToggleActiveEffect(event);
  }
}
