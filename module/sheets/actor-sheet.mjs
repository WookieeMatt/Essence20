import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { Dice } from "../dice.mjs";

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
    return `systems/essence20/templates/actor/actor-${this.actor.type}-sheet.hbs`;
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

    // // Prepare NPC data and items.
    // if (actorData.type == 'npc') {
    //   this._prepareItems(context);
    // }

    // Might need to filter like above eventually
    this._prepareItems(context);

    // Prepare npc data and items.
    if (['npc', 'zord', 'megaformZord', 'vehicle'].includes(actorData.type)) {
      this._prepareDisplayedNpcSkills(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    // Prepare Zords for MFZs
    this._prepareZords(context);
    
    return context;
  }

  /**
   * Prepare skills that are always displayed for NPCs.
   *
   * @param {Object} context The actor data to prepare.
   *
   * @return {undefined}
   */
  _prepareDisplayedNpcSkills(context) {
    let displayedNpcSkills = {};

    // Include any skill that have specializations
    for (let skill in context.specializations) {
      displayedNpcSkills[skill] = true;
    }

    // Include any skills not d20, are specialized, or have a modifier
    for (let [_, skills] of Object.entries(context.system.skills)) {
      for (let [skill, fields] of Object.entries(skills)) {
        if (fields.shift != 'd20' || fields.isSpecialized || fields.modifier) {
          displayedNpcSkills[skill] = true;
        }
      }
    }

    context.displayedNpcSkills = displayedNpcSkills;
  }

  /**
   * Prepare Zords for MFZs.
   *
   * @param {Object} context The actor data to prepare.
   *
   * @return {undefined}
   */
  _prepareZords(context) {
    if (this.actor.type == 'megaformZord') {
      let zords = [];

      for (let zordId of this.actor.system.zordIds) {
        zords.push(game.actors.get(zordId));
      }

      context.zords = zords;
    }
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
   * @param {Object} context The actor data to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const altModes = [];
    const armors = [];
    const bonds = [];
    const features = []; // Used by Zords
    const gears = [];
    const hangUps = [];
    const magicBaubles = [];
    const megaformTraits = [];
    const origins = []; // Used by PCs
    const perks = []; // Used by PCs
    const powers = []; // Used by PCs
    const classFeatures = []; // Used by PCs
    const specializations = {};
    const spells = [];
    const threatPowers = [];
    const traits = []; // Catchall for Megaform Zords, Vehicles, NPCs
    const weapons = [];
    const classFeaturesById = {};
    let equippedArmorEvasion = 0;
    let equippedArmorToughness = 0;
    
    // // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      const itemType = i.type;
      switch (itemType) {
        case 'altMode':
          altModes.push(i);
          break;
        case 'armor':
          if (i.system.equipped) {
            equippedArmorEvasion += parseInt(i.system.bonusEvasion);
            equippedArmorToughness += parseInt(i.system.bonusToughness);
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
        case 'hangUp':
          hangUps.push(i);
          break;
        case 'magicBauble':
          magicBaubles.push(i);
          break;  
        case 'megaformTrait':
          megaformTraits.push(i);
          break;
        case 'origin':
          origins.push(i);
          break;
        case 'perk':
          perks.push(i);
          break;
        case 'power':
          powers.push(i);
          break;
        case 'spell':
          spells.push(i);
          break;
        case 'classFeature':
          classFeatures.push(i);
          classFeaturesById[i._id] = i.name;
          break;
        case 'specialization':
          const skill = i.system.skill;
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
    context.altModes = altModes;
    context.armors = armors;
    context.bonds = bonds;
    context.classFeatures = classFeatures;
    context.classFeaturesById = classFeaturesById;
    context.equippedArmorEvasion = equippedArmorEvasion;
    context.equippedArmorToughness = equippedArmorToughness;
    context.features = features;
    context.gears = gears;
    context.hangUps = hangUps;
    context.magicBaubles = magicBaubles;
    context.megaformTraits = megaformTraits;
    context.origins = origins;
    context.perks = perks;
    context.powers = powers;
    context.spells = spells;
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

    // Delete Zord from MFZ
    html.find('.zord-delete').click(this._onZordDelete.bind(this));

    // Edit specialization name inline
    html.find(".inline-edit").change(this._onInlineEdit.bind(this));

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    if (this.actor.isOwner) {
      html.find('.rollable').click(this._onRoll.bind(this));
    }

    // Open and collapse Item content
    html.find('.accordion-label').click(ev => {
      const el = ev.currentTarget;
      const parent = $(el).parents('.accordion-wrapper');
      parent.toggleClass('open');
    });

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
    return await Item.create(itemData, { parent: this.actor });
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
    const rollType = dataset.rollType;

    if (!rollType) {
      return;
    }

    // Handle type-specific rolls.
    if (rollType == 'skill') {
      const skillRollOptions = await this._dice.getSkillRollOptions(dataset);

      if (skillRollOptions.cancelled) {
        return;
      }

      this._dice.rollSkill(dataset, skillRollOptions, this.actor);
    } else if (rollType == 'initiative') {
      this._dice.handleInitiativeRoll(dataset, this.actor);
    } else { // Handle items
      const itemId = element.closest('.item').dataset.itemId;
      const item = this.actor.items.get(itemId);

      if (rollType == 'power') {
        const classFeature = this.actor.items.get(item.system.classFeatureId);
        if (classFeature) {
          classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - 1) });
        }
      } else if (rollType == 'classFeature') {
        // If a Class Feature is being used, decrement uses
        await item.update({ 'system.uses.value': Math.max(0, item.system.uses.value - 1) });
      }

      if (item) return item.roll(dataset);
    }
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @override
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;

    // Get the target actor
    let sourceActor = await fromUuid(data.uuid);
    if (!sourceActor) return false;

    // Handles dropping Zords onto Megaform Zords
    if (this.actor.type == 'megaformZord' && sourceActor.type == 'zord') {
      const zordIds = duplicate(this.actor.system.zordIds);

      // Can't contain duplicate Zords
      if (!zordIds.includes(sourceActor.id)) {
        zordIds.push(sourceActor.id);
        await this.actor.update({
          "system.zordIds": zordIds
        }).then(this.render(false));
      }
    } else {
      return false;
    }
  }

  /**
   * Handle deleting Zords from MFZs
   * @param {Event} event   The originating click event
   * @private
   */
  async _onZordDelete(event) {
    const li = $(event.currentTarget).parents(".zord");
    const zordId = li.data("zordId");
    let zordIds = this.actor.system.zordIds.filter(x => x !== zordId);
    this.actor.update({
      "system.zordIds": zordIds,
    });
    li.slideUp(200, () => this.render(false));
  }
}
