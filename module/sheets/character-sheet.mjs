import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";
import { computeEssenceSpend } from "../helpers/skill-picker.mjs";

export class Essence20CharacterActorSheet extends Essence20BaseActorSheet {
  static TABS = {
    primary: {
      tabs: [
        { id: "skills", group: 'primary', label: "E20.TabSkills" },
        { id: "gear", group: 'primary', label: "E20.TabGear" },
        { id: "spells", group: 'primary', label: "E20.TabSpells" },
        { id: "powers", group: 'primary', label: "E20.TabPowers" },
        { id: "perks", group: 'primary', label: "E20.TabPerks" },
        { id: "altmode", group: 'primary', label: "E20.TabAltMode" },
        { id: "zords", group: 'primary', label: "E20.TabZords" },
        { id: "contacts", group: 'primary', label: "E20.TabContacts" },
        { id: "background", group: 'primary', label: "E20.TabBackground" },
        { id: "effects", group: 'primary', label: "E20.TabEffects" },
      ],
      initial: "skills",
    },
  };

  static PARTS = {
    header: {
      template: "systems/essence20/templates/actor/headers/character.hbs",
    },
    sidebar: {
      template: "systems/essence20/templates/actor/sidebars/character.hbs",
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    skills: {
      template: "systems/essence20/templates/actor/parts/main/character-skills.hbs",
      scrollable: [''],
    },
    gear: {
      template: "systems/essence20/templates/actor/parts/main/character-gear.hbs",
      scrollable: [''],
    },
    spells: {
      template: "systems/essence20/templates/actor/parts/main/character-spells.hbs",
      scrollable: [''],
    },
    powers: {
      template: "systems/essence20/templates/actor/parts/main/character-powers.hbs",
      scrollable: [''],
    },
    perks: {
      template: "systems/essence20/templates/actor/parts/main/character-perks.hbs",
      scrollable: [''],
    },
    altmode: {
      template: "systems/essence20/templates/actor/parts/main/character-altmode.hbs",
      scrollable: [''],
    },
    zords: {
      template: "systems/essence20/templates/actor/parts/main/character-zords.hbs",
      scrollable: [''],
    },
    contacts: {
      template: "systems/essence20/templates/actor/parts/main/character-contacts.hbs",
      scrollable: [''],
    },
    background: {
      template: "systems/essence20/templates/actor/parts/main/character-background.hbs",
      scrollable: [''],
    },
    effects: {
      template: "systems/essence20/templates/actor/tabs/effects.hbs",
      scrollable: [''],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._prepareSkillRankAllocation(context);
    return context;
  }

  /**
   * Prepare skill rank allocation calculations for PCs by adding the number of shifts,
   * Specializations, Conditioning, and (for Spellcasting/Weird) essenceAttribution present for
   * each Essence. Delegates to the same math the Skill Picker app uses for NPC-like actors
   * (module/helpers/skill-picker.mjs) rather than duplicating it - that function already reads
   * everything it needs straight off the actor, so this just needs to assign its result into the
   * shape pc-skills.hbs already expects.
   * @param {Object} context The actor data to prepare.
   */
  _prepareSkillRankAllocation(context) {
    context.system.skillRankAllocation = computeEssenceSpend(this.actor);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._applyConditionalTabs();
  }

  _applyConditionalTabs() {
    const visibility = {
      skills: true,
      gear: true,
      spells: this.actor.system.canSpellcast,
      powers: this.actor.system.canMorph,
      perks: true,
      altmode: this.actor.system.canTransform,
      zords: this.actor.system.canHaveZord,
      contacts: true,
      background: true,
      effects: true,
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
