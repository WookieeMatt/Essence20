import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

export class Essence20NPCActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "npc", group: 'primary', label: "E20.TabNPC" },
        { id: "contact", group: 'primary', label: "E20.TabContact" },
        { id: "altmode", group: 'primary', label: "E20.TabAltMode" },
        { id: "effects", group: 'primary', label: "E20.TabEffects" },
        { id: "notes", group: 'primary', label: "E20.TabNotes" },
      ],
      initial: "npc",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/npc.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/npc.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    npc: {
      template: "systems/essence20/templates/actor/parts/main/npc.hbs",
      scrollable: [''],
    },
    contact: {
      template: "systems/essence20/templates/actor/parts/main/npc-contact.hbs",
      scrollable: [''],
    },
    altmode: {
      template: "systems/essence20/templates/actor/parts/main/npc-altmode.hbs",
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

  _onRender(context, options) {
    super._onRender(context, options);
    this._applyConditionalTabs();
  }

  _applyConditionalTabs() {
    const visibility = {
      npc: this.actor.system.isNPC,
      contact: this.actor.system.isContact,
      altmode: this.actor.system.canTransform,
      notes: true,
    };

    for (const [tabId, visible] of Object.entries(visibility)) {
      const navLink = this.element.querySelector(`nav.tabs a[data-tab="${tabId}"]`);
      if (navLink) navLink.style.display = visible ? '' : 'none';
    }

    const activeTab = this.tabGroups?.primary;
    if (activeTab && !visibility[activeTab]) {
      const firstVisible = Object.keys(visibility).find((tabId) => visibility[tabId]);
      if (firstVisible) this.changeTab(firstVisible, 'primary');
    }
  }
}
