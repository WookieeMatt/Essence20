import { Essence20BaseActorSheet } from "./base-actor-sheet.mjs";

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
        { id: "notes", group: 'primary', label: "E20.TabNotes" },
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
    notes: {
      template: "systems/essence20/templates/actor/tabs/notes.hbs",
      scrollable: [''],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._prepareSkillRankAllocation(context);
    return context;
  }

  /**
   * Prepare skill rank allocation calculations for PCs by adding the number of shifts
   * and Specializations present for each Essence.
   * @param {Object} context The actor data to prepare.
   */
  _prepareSkillRankAllocation(context) {
    const unrankedIndex = CONFIG.E20.skillShiftList.indexOf('d20');

    for (const essence in CONFIG.E20.originEssences) {
      let essenceUpshifts = 0;
      let numSpecializations = 0;
      let essenceStrings = [];

      for (const skill of CONFIG.E20.skillsByEssence[essence]) {
        const skillData = context.system.skills[skill];
        const skillIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(skillData.shift));

        const skillUpshifts = Math.max(0, unrankedIndex - skillIndex);
        if (skillUpshifts) {
          essenceStrings.push(`${skillUpshifts} ${CONFIG.E20.skills[skill]}`);
          essenceUpshifts += skillUpshifts;
        }

        for (const specialization of context.specializations[skill] || []) {
          numSpecializations += 1;
          essenceStrings.push(`1 ${specialization.name}`);
        }
      }

      context.system.skillRankAllocation[essence].string = essenceStrings.join(' + ');
      context.system.skillRankAllocation[essence].value = essenceUpshifts + numSpecializations;
    }

    context.system.skillRankAllocation['strength'].string = [
      context.system.skillRankAllocation['strength'].string,
      `${context.system.conditioning} ${game.i18n.localize('E20.ActorConditioning')}`,
    ].filter(Boolean).join(' + ');
    context.system.skillRankAllocation['strength'].value += context.system.conditioning;

    const initiativeIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(context.system.skills[context.system.initiative.skill].shift));
    const initiativeUpshifts = Math.max(0, unrankedIndex - initiativeIndex);

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
