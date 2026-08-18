import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

export class Essence20ZordActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "main", group: 'primary', label: "E20.TabMain" },
        { id: "passengers", group: 'primary', label: "E20.TabCrew" },
        { id: "effects", group: 'primary', label: "E20.TabEffects" },
        { id: "notes", group: 'primary', label: "E20.TabNotes" },
      ],
      initial: "main",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/zord.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/zord.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    main: {
      template: "systems/essence20/templates/actor/parts/main/zord.hbs",
      scrollable: [''],
    },
    passengers: {
      template: "systems/essence20/templates/actor/parts/main/zord-passengers.hbs",
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
