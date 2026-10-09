import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { getActionsTabContext } from "../mechanics/actions/action-economy.mjs";

export class Essence20MegaformActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "main", group: 'primary', label: "E20.TabMain" },
        { id: "actions", group: 'primary', label: "E20.TabActions" },
        { id: "combiners", group: 'primary', label: "E20.TabCombiners" },
        { id: "effects", group: 'primary', label: "E20.Rules.Tab" },
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
    // Each participant's Health, highest first, as the books print a Megazord's ("HEALTH (9/9/7/7/7)") - by max, so a
    // participant keeps its place as it takes damage. Stun follows the same order, so the two lines read down together.
    const system = this.actor.system;
    const order = (system.participantHealth ?? []).map((row, index) => ({ row, index }))
      .sort((a, b) => (b.row.max - a.row.max) || (b.row.value - a.row.value));
    context.participantHealthSorted = order.map(({ row }) => row);
    context.participantStunSorted = order.map(({ index }) => system.participantStun?.[index]).filter(Boolean);
    return context;
  }
}
