import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { getNumActions } from "../helpers/actor.mjs";
import { onLevelChange } from "../sheet-handlers/role-handler.mjs";
import { showCrossoverOptions } from "../sheet-handlers/crossover-handler.mjs";
import { prepareSystemActors, onSystemActorsDelete, onVehicleRoleUpdate, onCrewNumberUpdate } from "../sheet-handlers/vehicle-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransform } from "../sheet-handlers/transformer-handler.mjs";
import {
  onRest,
  onRoll,
  onToggleAccordion,
  onToggleHeaderAccordion,
} from "../sheet-handlers/listener-misc-handler.mjs";
import { onDropActor, onDropItem } from "../sheet-handlers/drop-handler.mjs";
import {
  onItemCreate,
  onItemEdit,
  onItemDelete,
  onInlineEdit,
} from "../sheet-handlers/listener-item-handler.mjs";
import { getItemsOfType } from "../helpers/utils.mjs";

export class Essence20ActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
    this.accordionStates = { skills: '' };
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["essence20", "sheet", "actor"],
      width: 620,
      height: 574,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }],
    });
  }

  /** @override */
  get template() {
    return `systems/essence20/templates/actor/sheets/${this.actor.type}.hbs`;
  }

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Make all the Essence20 consts accessible
    context.config = CONFIG.E20;

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.toObject(false);

    // Add the actor's system data to context for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Might need to filter like above eventually
    this._prepareItems(context);

    // Prepare npc data and items.
    if (['npc', 'zord', 'megaform', 'vehicle', 'companion'].includes(actorData.type)) {
      this._prepareDisplayedNpcSkills(context);
    }

    // Prepare WeaponEffect Skill List
    this._prepareWeaponEffectSkills(actorData, context);

    // Prepare number of actions
    if (['giJoe', 'npc', 'pony', 'powerRanger', 'transformer'].includes(actorData.type)) {
      context.numActions = getNumActions(this.actor);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    // Prepare actors that are attached to other actors
    prepareSystemActors(this.actor, context);

    context.accordionStates = this.accordionStates;
    context.canMorphOrTransform = context.actor.system.canMorph || context.actor.system.canTransform;

    // Prepare PC skill rank allocation
    if (["giJoe", "pony", "powerRanger", "transformer"].includes(this.actor.type)) {
      this._prepareSkillRankAllocation(context);
    }

    return context;
  }

  /** @override */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    if (this.actor.isOwner) {
      // Crossover Button for Character Sheets
      if (["giJoe", "npc", "pony", "powerRanger", "transformer"].includes(this.actor.type)) {
        buttons = [
          {
            label: game.i18n.localize('E20.Crossover'),
            class: 'configure-actor',
            icon: 'fas fa-cog',
            onclick: (ev) => showCrossoverOptions(this, ev),
          },
          ...buttons,
        ];
      }
    }

    return buttons;
  }

  /**
   * Handles clicking the lock/unlock button
   * @param {Event} event The originating click event
   * @return {undefined}
   */
  _toggleLock(event) {
    this._isLocked = !this._isLocked;
    $(event.currentTarget).find("i").toggleClass("fa-lock-open fa-lock");
  }

  /**
   * Prepare skills that are always displayed for NPCs.
   * @param {Object} context The actor data to prepare.
   * @return {undefined}
   */
  _prepareDisplayedNpcSkills(context) {
    let displayedNpcSkills = {};

    // Include any skill that have specializations
    for (let skill in context.specializations) {
      displayedNpcSkills[skill] = true;
    }

    // Include any skills not d20, are specialized, or have a modifier
    for (let [skill, fields] of Object.entries(context.system.skills)) {
      if (fields.shift != 'd20' || fields.isSpecialized || fields.modifier) {
        displayedNpcSkills[skill] = true;
      }
    }

    context.displayedNpcSkills = displayedNpcSkills;
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

    const initiativeIndex = Math.max(0, CONFIG.E20.skillShiftList.indexOf(context.system.initiative.shift));
    const initiativeUpshifts = Math.max(0, unrankedIndex - initiativeIndex);
    context.system.skillRankAllocation['speed'].string = [
      context.system.skillRankAllocation['speed'].string,
      `${initiativeUpshifts} ${game.i18n.localize('E20.ActorInitiative')}`,
    ].filter(Boolean).join(' + ');
    context.system.skillRankAllocation['speed'].value += initiativeUpshifts;
  }

  /**
   * Prepare skill list to be used or weaponEffects on an actor
   * @param {Object} actorData The acor data converted to an object
   * @param {Object} context The actor data to prepare.
   */
  _prepareWeaponEffectSkills(actorData, context) {
    let hasSkillDie = false;
    let skillDieName = null;
    const items = getItemsOfType ("role", actorData.items);
    if (items.length && items[0].system.skillDie.isUsed) {
      hasSkillDie = true;
      skillDieName = items[0].system.skillDie.name;
    }

    let weaponEffectSkills = {};
    for (const skill of Object.keys(actorData.system.skills)) {
      if (skill != 'wealth' && (skill != 'roleSkillDie' || hasSkillDie)) {
        weaponEffectSkills[skill] = {
          key: skill,
          label: skill == 'roleSkillDie' && hasSkillDie
            ? skillDieName
            : game.i18n.localize(CONFIG.E20.skills[skill]),
        };
      }
    }

    context.weaponEffectSkills = weaponEffectSkills;
  }

  /**
   * Organize and classify Items for Character sheets.
   * @param {Object} context The actor data to prepare.
   * @return {undefined}
   * @private
   */
  _prepareItems(context) {
    // Initialize containers.
    const alterations = [];
    const altModes = [];
    const armors = [];
    const bonds = [];
    const contacts = [];
    const features = []; // Used by Zords
    const focuses = [];
    const gears = [];
    const hangUps = [];
    const influences = [];
    const magicBaubles = [];
    const megaformTraits = [];
    const origins = []; // Used by PCs
    const perks = []; // Used by PCs
    const powers = []; // Used by PCs
    const shields = [];
    const specializations = {};
    const spells = [];
    const upgrades = [];
    const traits = []; // Used by Vehicles
    const weapons = [];
    let activeShieldString = '';
    let activeShieldValue = 0;
    let passiveShieldString = '';
    let passiveShieldValue = 0;
    let equippedArmorEvasion = 0;
    let equippedArmorToughness = 0;
    let role = null;
    let rolePoints = null;

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      const itemType = i.type;

      switch (itemType) {
      case 'alteration':
        alterations.push(i);
        break;
      case 'altMode':
        altModes.push(i);
        break;
      case 'armor':
        if (i.system.equipped) {
          equippedArmorEvasion += parseInt(i.system.totalBonusEvasion);
          equippedArmorToughness += parseInt(i.system.totalBonusToughness);
        }

        armors.push(i);
        break;
      case 'bond':
        bonds.push(i);
        break;
      case 'contact':
        contacts.push(i);
        break;
      case 'feature':
        features.push(i);
        break;
      case 'focus':
        focuses.push(i);
        break;
      case 'gear':
        gears.push(i);
        break;
      case 'hangUp':
        hangUps.push(i);
        break;
      case 'influence':
        influences.push(i);
        break;
      case 'magicBauble':
        magicBaubles.push(i);
        break;
      case 'megaformTrait':
        megaformTraits.push(i);
        break;
      case 'origin':
        i.skillsString = i.system.skills.map(skill => {
          return CONFIG.E20.originSkills[skill];
        }).join(", ");
        i.essenceString = i.system.essences.map(essence => {
          return CONFIG.E20.originEssences[essence];
        }).join(", ");
        origins.push(i);
        break;
      case 'perk':
        perks.push(i);
        break;
      case 'power':
        powers.push(i);
        break;
      case 'shield':
        shields.push(i);
        break;
      case 'spell':
        spells.push(i);
        break;
      case 'rolePoints':
        rolePoints = i;

        {
          const defenseLetters = [];

          if (rolePoints.system.bonus.defenseBonus.cleverness) {
            defenseLetters.push('C');
          }

          if (rolePoints.system.bonus.defenseBonus.evasion) {
            defenseLetters.push('E');
          }

          if (rolePoints.system.bonus.defenseBonus.toughness) {
            defenseLetters.push('T');
          }

          if (rolePoints.system.bonus.defenseBonus.willpower) {
            defenseLetters.push('W');
          }

          rolePoints.system.bonus.defenseBonus.string = defenseLetters.join(', ');
          rolePoints.system.isSpendable = !!(rolePoints.system.resource.max || rolePoints.system.powerCost);
        }

        break;
      case 'role':
        role = i;
        break;
      case 'specialization':
        {
          const skill = i.system.skill;
          const existingSkillSpecializations = specializations[skill];
          existingSkillSpecializations ? specializations[skill].push(i) : specializations[skill] = [i];
        }

        break;
      case 'trait':
        traits.push(i);
        break;
      case 'upgrade':
        // Unparented upgrades on an actor can only be alt-mode armor upgrades
        if (!i.flags?.essence20?.parentId && this.actor.system.canTransform && i.system.type == "armor") {
          if (i.system.armorBonus.defense == "evasion"){
            equippedArmorEvasion += parseInt(i.system.armorBonus.value);
          } else if (i.system.armorBonus.defense == "toughness") {
            equippedArmorToughness += parseInt(i.system.armorBonus.value);
          }
        }

        upgrades.push(i);
        break;
      case 'weapon':
        weapons.push(i);
        break;
      }
    }

    // Assign and return
    context.alterations = alterations;
    context.altModes = altModes;
    context.armors = armors;
    context.bonds = bonds;
    context.contacts = contacts;
    context.features = features;
    context.gears = gears;
    context.focuses = focuses;
    context.hangUps = hangUps;
    context.influences = influences;
    context.magicBaubles = magicBaubles;
    context.megaformTraits = megaformTraits;
    context.origins = origins;
    context.perks = perks;
    context.powers = powers;
    context.rolePoints = rolePoints;
    context.role = role;
    context.shields = shields;
    context.spells = spells;
    context.specializations = specializations;
    context.traits = traits;
    context.upgrades = upgrades;
    context.weapons = weapons;

    this.actor.update({
      "system.defenses.evasion.armor": equippedArmorEvasion,
      "system.defenses.toughness.armor": equippedArmorToughness,
    }).then(this.render(false));
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => onItemEdit(ev, this.actor));

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(ev => onItemCreate(ev, this.actor));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => onItemDelete(ev, this));

    // Delete Zord from MFZ
    html.find('.system-actors-delete').click(ev => onSystemActorsDelete(ev, this));

    // Edit specialization name inline
    html.find(".inline-edit").change(ev => onInlineEdit(ev, this.actor));

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Morph Button
    html.find('.morph').click(() => onMorph(this));

    // Transform Button
    html.find('.transform').click(() => onTransform(this));

    // Roll buttons
    if (this.actor.isOwner) {
      html.find('.rollable').click(ev => onRoll(ev, this.actor));
    }

    // Open and collapse Item content
    html.find('.accordion-label').click(ev => onToggleAccordion(ev, this));

    // Open and collapse all Item contents in container
    html.find('.header-accordion-label').click(ev => onToggleHeaderAccordion(ev, this));

    html.find('.vehicle-role').change(ev => onVehicleRoleUpdate(ev, this));

    html.find('.num-crew').change(ev=> onCrewNumberUpdate(ev, this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }

    // Rest button
    html.find('.rest').click(() => onRest(this));

    const isLocked = this.actor.system.isLocked;

    // Inputs
    const inputs = html.find('input');
    // Selects all text when focused
    inputs.focus(ev => ev.currentTarget.select());
    // Set readonly if sheet is locked
    inputs.attr('readonly', isLocked);
    // Don't readonly health and stun values
    html.find('.no-lock').attr('readonly', false);
    // Stun max is always locked
    html.find('.no-unlock').attr('readonly', true);

    // Disable selects if sheet is locked
    html.find('select').attr('disabled', isLocked);

    // Lock icon
    html.find('.lock-status').find('i').addClass(isLocked ? 'fa-lock' : 'fa-lock-open');

    // Toggling the lock button
    html.find('.lock-status').click(ev => {
      this.actor.update({
        "system.isLocked": !isLocked,
      });
      $(ev.currentTarget).find('i').toggleClass('fa-lock-open fa-lock');
      const inputs = html.find('input');
      inputs.attr('readonly', isLocked);
      html.find('.no-lock').attr('readonly', false);
      html.find('.no-unlock').attr('readonly', true);
      html.find('select').attr('disabled', isLocked);
    });
  }

  /**
   * Handle dropping an Item onto an Actor.
   * @param {DragEvent} event The concluding DragEvent which contains drop data
   * @param {Object} data The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   * @override
   */
  async _onDropItem(event, data) {
    return onDropItem(data, this.actor, super._onDropItem.bind(this, event, data));
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event The concluding DragEvent which contains drop data
   * @param {Object} data The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   * @override
   */
  async _onDropActor(event, data) {
    return onDropActor(data, this);
  }

  /**
   * Handle changes to an input element, submitting the form if options.submitOnChange is true.
   * Do not preventDefault in this handler as other interactions on the form may also be occurring.
   * @param {Event} event The initial change event
   */
  async _onChangeInput(event) {
    await super._onChangeInput(event);

    if (event.currentTarget.name == "system.level") {
      return await onLevelChange(this.actor, this.actor.system.level);
    }
  }
}
