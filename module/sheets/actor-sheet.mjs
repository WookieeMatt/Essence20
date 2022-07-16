import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";
import {Dice} from "../dice.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class Essence20ActorSheet extends ActorSheet {
  constructor(actor, options) {
    super(actor, options);
    this._dice = new Dice(game.i18n, CONFIG.E20, ChatMessage);
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["essence20", "sheet", "actor"],
      width: 620,
      height: 574,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }]
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
    const bonds = [];
    let equippedArmorEffect = 0;
    const features = []; // Used by Zords
    const hangUps = [];
    const influences = [];
    const gears = [];
    const generalPerks = []; // Used by PCs
    const perks = [];
    const powers = []; // Used by PCs
    const specializations = {};
    const threatPowers = [];
    const traits = []; // Catchall for Megaform Zords, Vehicles, NPCs
    const weapons = [];

    // // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      const itemType = i.type;
      switch(itemType) {
        case 'armor':
          if (i.data.equipped) {
            equippedArmorEffect += parseInt(i.data.effect);
          }
          armors.push(i);
          break;
        case 'bond':
          bonds.push(i);
          break;
        case 'feature':
          features.push(i);
          break;
        case 'gear':
          gears.push(i);
          break;
        case 'generalPerk':
          generalPerks.push(i);
          break;
        case 'hangUp':
          hangUps.push(i);
          break;
        case 'perk':
          perks.push(i);
          break;
        case 'power':
          powers.push(i);
          break;
        case 'specialization':
          const skill = i.data.skill;
          const existingSkillSpecializations = specializations[skill];
          existingSkillSpecializations ? specializations[skill].push(i) : specializations[skill] = [i];
          break;
        case 'threatPower':
          threatPowers.push(i);
          break;
        case 'trait':
          traits.push(i);
          break;
        case 'weapon':
          weapons.push(i);
          break;
      };
    }

    // Assign and return
    context.armors = armors;
    context.bonds = bonds;
    context.equippedArmorEffect = equippedArmorEffect;
    context.influences = influences;
    context.features = features;
    context.gears = gears;
    context.generalPerks = generalPerks;
    context.hangUps = hangUps;
    context.perks = perks;
    context.powers = powers;
    context.specializations = specializations;
    context.threatPowers = threatPowers;
    context.traits = traits;
    context.weapons = weapons;
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
      let newValue = element.type == 'checkbox' ? element.checked : element.value;

      return item.update({ [field]: newValue });
   }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle type-specific rolls.
    if (dataset.rollType) {
      if (['item', 'power'].includes(dataset.rollType)) {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);

        // If a Power is being used, decrement Personal Power
        if (dataset.rollType == 'power') {
          await this.actor.update({ 'system.personalPower.value': Math.max(0, this.actor.system.personalPower.value - 1) });
        }

        if (item) return item.roll();
      }
      else if (dataset.rollType == 'skill') {
        const skillRollOptions = await this._dice.getSkillRollOptions(dataset);

        if (skillRollOptions.cancelled) {
          return;
        }

        this._dice.rollSkill(dataset, skillRollOptions, this.actor);
      }
      else if (dataset.rollType == 'initiative') {
        this.actor.rollInitiative({createCombatants: true});
      }
      else if (['influence', 'generalPerk'].includes(dataset.rollType)) {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);

        // Initialize chat data.
        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');
        const label = `[${item.type}] ${item.name}`;

        let content = '';

        if (dataset.rollType == 'influence') {
          content += `Bond: ${item.system.bond || 'None'} <br>`;
          content += `Hang Up: ${item.system.hangUp || 'None'} <br>`;
          content += `Perk: ${item.system.perk || 'None'}`;
        }
        else { // General Perk
          content += `Source: ${item.system.source || 'None'} <br>`;
          content += `Prerequisite: ${item.system.prerequisite || 'None'} <br>`;
          content += `Description: ${item.system.description || 'None'}`;
        }

        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: content,
        });
      }
    }
  }
}
