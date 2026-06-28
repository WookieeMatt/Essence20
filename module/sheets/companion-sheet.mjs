import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { prepareActiveEffectCategories } from "../helpers/effects.mjs";

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
      template: "systems/essence20/templates/actor/parts/headers/companion.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    main: {
      template: "systems/essence20/templates/actor/parts/main/companion.hbs",
      scrollable: [''],
    },
    effects: {
      template: "systems/essence20/templates/actor/parts/misc/active-effects.hbs",
      scrollable: [''],
    },
    notes: {
      template: "systems/essence20/templates/actor/parts/misc/notes.hbs",
      scrollable: [""],
    },

  };

  async _preparePartContext(partId, context, options) {
    console.log(options);
    switch ( partId ) {
    case "main": context = await this._prepareMainContext(context); break;
    case "effects": context = await this._prepareEffectsContext(context); break;
    case "notes": context = await this._prepareNotesContext(context); break;
    }

    return context;
  }

  async _prepareNotesContext(context) {
    // if (this.editingDescriptionTarget) {
    //   context.editingDescription = {
    //     target: this.editingDescriptionTarget,
    //     value: foundry.utils.getProperty(this.document._source, this.editingDescriptionTarget),
    //   };
    // }

    return context;
  }

  async _prepareMainContext(context) {
    return context;
  }

  async _prepareEffectsContext(context) {
    context.effects = await prepareActiveEffectCategories(this.document.effects);
    return context;
  }
}
