import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class Essence20ActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);

    this._accordionStates = { skills: '' };
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
    return `systems/essence20/templates/actor/sheets/${this.actor.type}.hbs`;
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

    context.accordionStates = this._accordionStates;

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

      if (item.type == "origin") {
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

    //Transform Button
    html.find('.transform').click(this._transform.bind(this));

    // Rollable abilities.
    if (this.actor.isOwner) {
      html.find('.rollable').click(this._onRoll.bind(this));
    }

    // Open and collapse Item content
    html.find('.accordion-label').click(ev => {
      const el = ev.currentTarget;
      const parent = $(el).parents('.accordion-wrapper');

      // Avoid collapsing NPC skills container on rerender
      if (parent.hasClass('skills-container')) {
        const isOpen = this._accordionStates.skills;
        this._accordionStates.skills = isOpen ? '' : 'open';
        this.render();
      } else {
        parent.toggleClass('open');
      }
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

  async _transform() {
    const altModeList = [];
    for (const item of this.actor.items) {
      if (item.type == "altMode") {
        altModeList.push(item);
      }
    }
    if (!this.actor.system.isTransformed) {
      if(altModeList.length < 1) {
        console.log("Error no Alt Modes change to screen display");
      } else if (altModeList.length == 1) {
        this._transformAltMode(altModeList);
      } else {
        this._showAltModeChoiceDialog(altModeList, false);
      }

    } else {
      if(altModeList.length < 1) {
        console.log("Error No Alt Mode");
        await this.actor.update({
          "system.isTransformed": false,
        }).then(this.render(false));
      } else if (altModeList.length == 1) {
        this._transformBotMode();
      } else {
        this._showAltModeChoiceDialog(altModeList, true);
      }
    }
  }

  async _showAltModeChoiceDialog(altModeList,transformed) {
    const choices = {};
    if (transformed) {
      choices["BotMode"] = {
        chosen: false,
        label: "BotMode",
      }
    }
    for (const altMode of altModeList) {
      console.log(altMode);
      if (this.actor.system.altModeName != altMode.name) {
        choices[altMode.name] = {
          chosen: false,
          label: altMode.name,
        }
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.AltModeChoice'),
        content: await renderTemplate("systems/essence20/templates/dialog/drop-origin.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._altModeSelect(altModeList, this._rememberOptions(html))
          }
        },
      },
    ).render(true);
  }

  async _altModeSelect (altModeList, options) {
    let selectedForm = "";
    let transformation = {};
    for (const [altMode, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedForm = altMode;
        break;
      }
    }
    if (selectedForm == "BotMode"){
      this._transformBotMode();
    } else {
      for(const mode of altModeList) {
        if (selectedForm == mode.name) {
          transformation = mode
          break
        }
      }
      this._transformAltMode(transformation)
    }
  }

  async _transformAltMode (altMode) {
    if (altMode.length) {
      altMode = altMode[0]
    }
    await this.actor.update({
      "system.movement.aerial.altmode": altMode.system.altModeMovement.aerial,
      "system.movement.swim.altmode": altMode.system.altModeMovement.aquatic,
      "system.movement.ground.altmode": altMode.system.altModeMovement.ground,
      "system.altModeSize": altMode.system.altModesize,
      "system.altModeName": altMode.name,
      "system.isTransformed": true,
    }).then(this.render(false));
  }

  async _transformBotMode () {
    await this.actor.update({
      "system.movement.aerial.altmode": 0,
      "system.movement.swim.altmode": 0,
      "system.movement.ground.altmode": 0,
      "system.isTransformed": false,
      "system.altModeName": "",
      "system.altModeSize": ""
    }).then(this.render(false));
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
      this.actor.rollSkill(dataset);
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
    if (data.type != 'Item') {
      return;
    }

    const sourceItem = await fromUuid(data.uuid);
    if (!sourceItem) return false;

    if (sourceItem.type == 'origin') {
      for (let actorItem of this.actor.items) {
        if(actorItem.type == 'origin') {
          ui.notifications.error(game.i18n.format(game.i18n.localize('E20.MulitpleOriginError')));
          return false
        }
      }

      await this._showOriginEssenceDialog(sourceItem, event, data);
    } else {
      super._onDropItem(event, data);
    }
  };

  /**
   * Displays a dialog for selecting an Essence for the given Origin.
   * @param {Object} origin    The Origin
   * @param {DragEvent} event  The concluding DragEvent which contains drop data
   * @param {object} data      The data transfer extracted from the event
   * @private
   */
  async _showOriginEssenceDialog(origin, event, data) {
    const choices = {};
    for (const essence of origin.system.essences) {
      choices[essence] = {
        chosen: false,
        label: CONFIG.E20.originEssences[essence],
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.EssenceIncrease'),
        content: await renderTemplate("systems/essence20/templates/dialog/drop-origin.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._showOriginSkillDialog(origin, this._rememberOptions(html), event, data)
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
   * @param {Object} origin    The Origin
   * @param {Object} options   The options resulting from _showOriginEssenceDialog()
   * @param {DragEvent} event  The concluding DragEvent which contains drop data
   * @param {object} data      The data transfer extracted from the event
   * @private
   */
  async _showOriginSkillDialog(origin, options, event, data) {
    const essences = Object.keys(options);
    const choices = {};
    let selectedEssence = "";

    for (const skill of origin.system.skills) {
      const essence = CONFIG.E20.skillToEssence[skill];
      if (options[essence] && essences.includes(essence)) {
        selectedEssence = essence;
        choices[skill] = {
          chosen: false,
          label: CONFIG.E20.originSkills[skill],
        };
      }
    }

    if (!selectedEssence) {
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoEssence'));
      return;
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.OriginBonusSkill'),
        content: await renderTemplate("systems/essence20/templates/dialog/drop-origin.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._originStatUpdate(origin, selectedEssence, this._rememberOptions(html), event, data)
          }
        },
      },
    ).render(true);
  }

  /**
  * Updates the actor with the information selected for the Origin
  * @param {Object} origin    The Origin
  * @param {Object} options   The options resulting from _showOriginSkillDialog()
  * @param {Object} essence   The essence selected in the _showOriginEssenceDialog()
  * @param {DragEvent} event  The concluding DragEvent which contains drop data
  * @param {object} data      The data transfer extracted from the event
  * @private
  */
  async _originStatUpdate(origin, essence, options, event, data) {
    let selectedSkill = "";
    for (const [skill, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedSkill = skill;
        break;
      }
    }

    if (!selectedSkill){
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoSkill'));
      return;
    }

    this._originPerkCreate(origin)

    const essenceValue = this.actor.system.essences[essence] + 1;
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

    super._onDropItem(event, data);

    await this.actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": origin.system.startingHealth,
      "system.health.value": origin.system.startingHealth,
      "system.movement.aerial.base": origin.system.baseAerialMovement,
      "system.movement.swim.base": origin.system.baseAquaticMovement,
      "system.movement.ground.base": origin.system.baseGroundMovement,
      "system.originEssencesIncrease": essence,
      "system.originSkillsIncrease": selectedSkill,
    });
}

  /**
  * Creates the Perk from the Origin on the Actor
  * @param {Object} origin   The Origin
  * @private
  */
  async _originPerkCreate(origin){
    let data = game.items.get(origin.system.originPerkIds[0]);
    if(!data) {
      for (let pack of game.packs){
        const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
        let originPerk = await compendium.getDocument(origin.system.originPerkIds[0]);
        if (originPerk) {
          data = originPerk;
        }
      }
    }
    return await Item.create(data, { parent: this.actor });
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
  * Handle deleting of an Origin from an Actor Sheet
  * @param {Object} origin   The Origin
  * @private
  */
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

    await this.actor.update({
      [essenceString]: essenceValue,
      [skillString]: newShift,
      "system.health.max": 0,
      "system.health.value": 0,
      "system.movement.aerial.base": 0,
      "system.movement.swim.base": 0,
      "system.movement.ground.base": 0,
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
