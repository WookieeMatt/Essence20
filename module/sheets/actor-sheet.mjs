import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { Dice } from "../dice.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class Essence20ActorSheet extends ActorSheet {
  constructor(actor, options) {
    super(actor, options);
    this._dice = new Dice(CONFIG.E20, ChatMessage);
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
    for (let [skill, fields] of Object.entries(context.system.skills)) {
      if (fields.shift != 'd20' || fields.isSpecialized || fields.modifier) {
        displayedNpcSkills[skill] = true;
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
    const contacts = [];
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
        case 'contact':
          contacts.push(i);
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
    context.contacts = contacts;
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
      if(item.type == "origin") {
        this._onOriginDelete(item);
      }
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
      const skillRollOptions = await this._dice.getSkillRollOptions(dataset, this.actor);

      if (skillRollOptions.cancelled) {
        return;
      }

      this._dice.rollSkill(dataset, skillRollOptions, this.actor);
    } else if (rollType == 'initiative') {
      this.actor.rollInitiative({createCombatants: true});
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
   * Handle dropping an Item onto an Actor.
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @override
   */
  async _onDropItem(event, data) {
    console.log(data);
    if (data.type == 'Item') {
      let sourceItem = await fromUuid(data.uuid);
      if (!sourceItem) return false;
      if (sourceItem.type == 'origin') {
        for (let actorItems of this.actor.items) {
          if(actorItems.type == 'origin') {
            return false
          }
        }
        await this._showOriginEssenceDialog(sourceItem);
      }
      const item = super._onDropItem(event, data);
    }
  };

  /**
   * Displays a dialog for selecting an Essence for the given Origin.
   * @param {Object} origin   The Origin
   * @private
   */
  async _showOriginEssenceDialog(origin) {
    const choices = {};
    for (const essence of origin.system.essences) {
      choices[essence] = {
        chosen: false,
        label: CONFIG.E20.originEssences[essence],
      }
    }

    new Dialog(
      {
        title: "Select Essence Score Increase Option",
        content: await renderTemplate("systems/essence20/templates/dialog/drop-origin.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: "Accept",
            callback: html => this._showOriginSkillDialog(origin, this._rememberOptions(html))
          }
        },
      },
    ).render(true);
  }

  /**
   * Returns values of inputs upon dialog submission. Used for passing data between sequential dialogs.
   * @param {HTML} html   The html of the dialog upon submission
   * @returns {Object>}  The dialog inputs and their submitted values
   * @private
   */
  _rememberOptions(html) {
    const options = {};
    html.find("input").each((i, el) => {
      options[el.id] = el.checked;
    });
    return options;
  };

  /**
   * Displays a dialog for selecting a Skill for the given Origin.
   * @param {Object} origin   The Origin
   * @param {Object} options   The options resulting from _showOriginEssenceDialog()
   * @private
   */
  async _showOriginSkillDialog(origin, options) {
    const essences = Object.keys(options);
    const choices = {};
    let selectedEssence = "";
    let selectedSkills = "";
    for (const skill of origin.system.skills) {
      const essence = CONFIG.E20.skillToEssence[skill];
      if (options[essence] && essences.includes(essence)) {
        console.log("Got Here 3");
        selectedEssence = essence;
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.essenceSkills[skill],
        };
      }
    }
    selectedSkills = choices;

    new Dialog(
      {
        title: "Select Origin Bonus Skill",
        content: await renderTemplate("systems/essence20/templates/dialog/drop-origin.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: "Accept",
            callback: html => this._originStatUpdate(origin, selectedEssence, selectedSkills, this._rememberOptions(html))
          }
        },
      },
    ).render(true);
  }

  async _originStatUpdate (origin, essence, skills, options) {
    const skillOptions = Object.keys(options);
    let selectedSkill = "";
    for (let i =0; i < skillOptions.length; i++) {
      if (options[skillOptions[i]]) {
        selectedSkill = skillOptions[i];
      }
    }
    this._originPerkCreate(origin)
    let essenceValue = this.actor.system.essences[essence] + 1;
    const essenceString = `system.essences.${essence}`;
    let skillString = "";
    let currentShift = "";
    let newShift = "";
    if (selectedSkill == "initiative"){
      skillString = `system.${selectedSkill}.shift`;
      currentShift = this.actor.system[selectedSkill].shift;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))]
    } else if (selectedSkill == "conditioning"){
      skillString = `system.${selectedSkill}`;
      currentShift = this.actor.system[selectedSkill];
      newShift = currentShift + 1;
    } else {
      currentShift = this.actor.system.skills[selectedSkill].shift;
      skillString = `system.skills.${selectedSkill}.shift`;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - 1))]
    }
    await this.actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": origin.system.startingHealth,
      "system.health.value": origin.system.startingHealth,
      "system.movement.aerial": origin.system.baseAerialMovement,
      "system.movement.swim": origin.system.baseAquaticMovement,
      "system.movement.ground": origin.system.baseGroundMovement,
      "system.originEssencesIncrease": essence,
      "system.originSkillsIncrease": selectedSkill
    });
  }

  async _originPerkCreate(origin){
    const data = game.items.get(origin.system.originPerkIds[0]);
    const type = "perk";
    const name = data.name;
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.

    return await Item.create(itemData, { parent: this.actor });
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

  async _onOriginDelete(origin) {

    let essence = this.actor.system.originEssencesIncrease;
    let essenceValue = this.actor.system.essences[essence] - 1;
    let skillString = "";
    let currentShift = "";
    let newShift = "";
    let selectedSkill = this.actor.system.originSkillsIncrease;
    if (selectedSkill == "initiative"){
      skillString = `system.${selectedSkill}.shift`;
      currentShift = this.actor.system[selectedSkill].shift;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))]
    } else if (selectedSkill == "conditioning"){
      skillString = `system.${selectedSkill}`;
      currentShift = this.actor.system[selectedSkill];
      newShift = currentShift - 1;
    } else {
      currentShift = this.actor.system.skills[selectedSkill].shift;
      skillString = `system.skills.${selectedSkill}.shift`;
      newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) + 1))]
    }
    const essenceString = `system.essences.${essence}`;
    const data = game.items.get(origin.system.originPerkIds[0]);
    console.log(data);
    await this.actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": 0,
      "system.health.value": 0,
      "system.movement.aerial": 0,
      "system.movement.swim": 0,
      "system.movement.ground": 0,
      "system.originEssencesIncrease": "",
      "system.originSkillsIncrease": ""
    });
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
