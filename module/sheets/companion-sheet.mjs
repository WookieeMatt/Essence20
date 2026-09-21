import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { getActionsTabContext } from "../helpers/action-economy.mjs";

export class Essence20CompanionActorSheet extends Essence20BaseActorSheet {
  /**@inheritDoc */
  static DEFAULT_OPTIONS = {
    // Foundry's DEFAULT_OPTIONS merge across the inheritance chain replaces arrays wholesale
    // rather than merging them element-wise (see foundry.utils.mergeObject's array handling) -
    // this class array was overwriting Essence20BaseActorSheet's own (which includes
    // "theme-wrapper", "e20-window"), so Companion sheets never got the ::-webkit-scrollbar/scrollbar-color
    // styling _theme_wrapper.scss provides everywhere else - just plain browser scrollbars.
    // Spread, not retyped. Foundry merges DEFAULT_OPTIONS down the class chain but REPLACES
    // arrays wholesale, so declaring `classes` here at all drops everything the base sheet
    // listed. Both sheets used to restate the list by hand and both had silently lost
    // "e20-window", the opt-in every window-frame rule keys off - which is why this sheet kept
    // losing its bottom-right corner long after that was fixed everywhere else.
    classes: [...Essence20BaseActorSheet.DEFAULT_OPTIONS.classes],
    tag: 'form',
    position: {
      width: 620,
      height: 574,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    window: {
      resizable: true,
    },
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "main", group: 'primary', label: "Main"},
        { id: "actions", group: 'primary', label: "E20.TabActions" },
        { id: "effects", group: 'primary', label: "Effects"},
        { id: "notes", group: 'primary', label: "Notes"},
      ],
      initial: "main",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/companion.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/companion.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    main: {
      template: "systems/essence20/templates/actor/parts/main/companion.hbs",
      scrollable: [''],
    },
    // The shared tab - every actor type builds its action economy from the same
    // data/actor/templates/common.mjs, so none of them needs a variant of its own.
    actions: {
      template: "systems/essence20/templates/actor/tabs/actions.hbs",
      scrollable: [''],
    },
    effects: {
      template: "systems/essence20/templates/actor/tabs/effects.hbs",
      scrollable: [''],
    },
    notes: {
      template: "systems/essence20/templates/actor/tabs/notes.hbs",
      scrollable: [""],
    },

  };

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === "main") context = await this._prepareMainContext(context);
    return context;
  }

  async _prepareMainContext(context) {
    return context;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actionsTab = getActionsTabContext(this.actor);
    return context;
  }
}
