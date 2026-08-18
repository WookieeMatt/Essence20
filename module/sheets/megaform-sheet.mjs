import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

export class Essence20MegaformActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "main", group: 'primary', label: "E20.TabMain" },
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
}
