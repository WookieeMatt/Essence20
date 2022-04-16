import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class Essence20ActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["essence20", "sheet", "actor"],
      width: 620,
      height: 620,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  /** @override */
  get template() {
    return `systems/essence20/templates/actor/actor-${this.actor.data.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

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

    // // Prepare character data and items.
    // if (actorData.type == 'character') {
    //   this._prepareItems(context);
    //   this._prepareCharacterData(context);
    // }

    // // Prepare NPC data and items.
    // if (actorData.type == 'npc') {
    //   this._prepareItems(context);
    // }

    // Might need to filter like above eventually
    this._prepareItems(context);

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    // for (let [k, v] of Object.entries(context.data.abilities)) {
    //   v.label = game.i18n.localize(CONFIG.BOILERPLATE.abilities[k]) ?? k;
    // }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const armors = [];
    let equippedArmorEffect = 0;
    const influences = [];
    const powers = [];
    const specializations = {};
    const threatPowers = [];

    // // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      const itemType = i.type;
      switch(itemType) {
        case 'armor':
          if (i.data.equipped) {
            equippedArmorEffect += i.data.effect;
          }
          armors.push(i);
        case 'influence':
          influences.push(i);
        case 'power':
          powers.push(i);
        case 'specialization':
          const skill = i.data.skill;
          const existingSkillSpecializations = specializations[skill];
          existingSkillSpecializations ? specializations[skill].push(i) : specializations[skill] = [i];
        case 'threatPower':
          threatPowers.push(i);
      };
    }

    // Assign and return
    context.armors = armors;
    context.equippedArmorEffect = equippedArmorEffect;
    context.influences = influences;
    context.powers = powers;
    context.specializations = specializations;
    context.threatPowers = threatPowers;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Edit specialization name inline
    html.find(".inline-edit").change(this._onInlineEdit.bind(this));

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    if (this.actor.isOwner) {
      html.find('.rollable').click(this._onRoll.bind(this));
    }

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle editing specialization names inline
   * @param {Event} event   The originating click event
   * @private
   */
   async _onInlineEdit(event) {
    event.preventDefault();
      let element = event.currentTarget;
      let itemId = element.closest(".item").dataset.itemId;
      let item = this.actor.items.get(itemId);
      let field = element.dataset.field;

      return item.update({ [field]: element.value });
   }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle type-specific rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
      else if (dataset.rollType == 'skill') {
        this._rollSkill(dataset);
      }
      else if (dataset.rollType == 'specialization') {
        this._rollSpecialization(dataset);
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle skill rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event
   * @private
   */
  _rollSkill(dataset) {
    let roll = null;

    // Create roll label
    const rolledSkill = dataset.skill;
    const rolledSkillStr = game.i18n.localize(CONFIG.E20.skills[rolledSkill]);
    const rollingForStr = game.i18n.localize(CONFIG.E20.rollingFor)
    let label = `${rollingForStr} ${rolledSkillStr}`;

    // Create roll formula
    const actorSkillData = this.actor.getRollData().skills;
    const rolledEssence = CONFIG.E20.skillToEssence[rolledSkill];
    const skillShift = actorSkillData[rolledEssence][rolledSkill].shift;

    if (!this._handleAutofail(skillShift, label)) {
      const modifier = actorSkillData[rolledEssence][rolledSkill].modifier;
      const formula = skillShift == 'd20'
        ? `d20 + ${modifier}`
        : `d20 + ${skillShift} + ${modifier}`;

      let roll = new Roll(formula, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
    }

    return roll;
  }

  /**
   * Handle specialization rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event
   * @private
   */
   _rollSpecialization(dataset) {
    let roll = null;

    // Create roll label
    const rolledSkill = dataset.skill;
    const rolledSpecialization = dataset.specialization;
    const rollingForStr = game.i18n.localize(CONFIG.E20.rollingFor)
    let label = `${rollingForStr} ${rolledSpecialization}`;

    // Create roll formula
    const actorSkillData = this.actor.getRollData().skills;
    const rolledEssence = CONFIG.E20.skillToEssence[rolledSkill];
    const skillShift = actorSkillData[rolledEssence][rolledSkill].shift;
    const modifier = actorSkillData[rolledEssence][rolledSkill].modifier;

    if (!this._handleAutofail(skillShift, label)) {
      let formula = '';
      for (const shift of CONFIG.E20.rollableShifts) {
        // Keep adding dice until you reach your shift level
        formula += shift + ' + ';
        if (shift == skillShift) {
          break;
        }
      }
      formula += modifier;

      let roll = new Roll(formula, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
    }

    return roll;
  }

    /**
   * Handle rolls that automatically fail.
   * @param {String} skillShift   The shift of the skill being rolled.
   * @param {String} label   The label generated so far for the roll, which will be appended to.
   * @returns {Boolean}   True if autofail occurs and false otherwise.
   * @private
   */
    _handleAutofail(skillShift, label) {
      let autofailed = false;

      if (CONFIG.E20.automaticShifts.includes(skillShift)) {
        const chatData = {
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        };
        switch(skillShift) {
          case 'autoFail':
            label += ' automatically fails';
            break;
          case 'fumble':
            label += ' automatically fails and fumbles'
            break;
        }
        chatData.content = label;
        ChatMessage.create(chatData);
        autofailed = true;
      }

      return autofailed;
    }
}
