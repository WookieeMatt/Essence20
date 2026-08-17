import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

export class Essence20VehicleActorSheet extends Essence20BaseActorSheet {
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
      template: "systems/essence20/templates/actor/headers/vehicle.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/vehicle.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    main: {
      template: "systems/essence20/templates/actor/parts/main/vehicle.hbs",
      scrollable: [''],
    },
    passengers: {
      template: "systems/essence20/templates/actor/parts/main/vehicle-passengers.hbs",
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
