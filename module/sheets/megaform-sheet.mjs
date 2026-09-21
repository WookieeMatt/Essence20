import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { getActionsTabContext } from "../helpers/action-economy.mjs";

export class Essence20MegaformActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "main", group: 'primary', label: "E20.TabMain" },
        { id: "actions", group: 'primary', label: "E20.TabActions" },
        { id: "combiners", group: 'primary', label: "E20.TabCombiners" },
        { id: "effects", group: 'primary', label: "E20.TabEffects" },
        { id: "notes", group: 'primary', label: "E20.TabNotes" },
      ],
      initial: "main",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/megaform.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/megaform.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    main: {
      template: "systems/essence20/templates/actor/parts/main/megaform.hbs",
      scrollable: [''],
    },
    // The shared tab - every actor type builds its action economy from the same
    // data/actor/templates/common.mjs, so none of them needs a variant of its own.
    actions: {
      template: "systems/essence20/templates/actor/tabs/actions.hbs",
      scrollable: [''],
    },
    combiners: {
      template: "systems/essence20/templates/actor/parts/main/megaform-combiners.hbs",
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actionsTab = getActionsTabContext(this.actor);
    return context;
  }
}
