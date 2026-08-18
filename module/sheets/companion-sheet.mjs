import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

export class Essence20CompanionActorSheet extends Essence20BaseActorSheet {
  /**@inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["essence20", "sheet", "actor"],
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
}
