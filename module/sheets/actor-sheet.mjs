import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { searchCompendium } from "../helpers/utils.mjs";

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
    const influences = [];
    const magicBaubles = [];
    const megaformTraits = [];
    const origins = []; // Used by PCs
    const perks = []; // Used by PCs
    const powers = []; // Used by PCs
    const classFeatures = []; // Used by PCs
    const specializations = {};
    const spells = [];
    const threatPowers = [];
    const upgrades = [];
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
        case 'upgrade':
          upgrades.push(i);
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
    context.features = features;
    context.gears = gears;
    context.hangUps = hangUps;
    context.influences = influences;
    context.magicBaubles = magicBaubles;
    context.megaformTraits = megaformTraits;
    context.origins = origins;
    context.perks = perks;
    context.powers = powers;
    context.spells = spells;
    context.specializations = specializations;
    context.threatPowers = threatPowers;
    context.upgrades = upgrades;
    context.weapons = weapons;

    this.actor.update({
      "system.defenses.evasion.armor": equippedArmorEvasion,
      "system.defenses.toughness.armor": equippedArmorToughness,
    }).then(this.render(false));
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
      } else if (item.type == "altMode") {
        this._onAltModeDelete(item);
      } else if (item.type == 'influence') {
        this._onInfluenceDelete(item)
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

    // Morph Button
    html.find('.morph').click(this._morph.bind(this));

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

        // Check if the container header toggle should be flipped
        let oneClosed = false;

        // Look for a closed Item
        const accordionLabels = el.closest('.collapsible-item-container').querySelectorAll('.accordion-wrapper');
        for (const accordionLabel of accordionLabels) {
          oneClosed = !$(accordionLabel).hasClass('open');
          if (oneClosed) break;
        }

        // Set header state to open if all Items are open; closed otherwise
        const container = el.closest('.collapsible-item-container').querySelector('.header-accordion-wrapper');
        if (oneClosed) {
          $(container).removeClass('open');
        } else {
          $(container).addClass('open');
        }
      }
    });

    // Open and collapse all Item contents in container
    html.find('.header-accordion-label').click(ev => {
      const el = ev.currentTarget;
      const isOpening = !$(el.closest('.header-accordion-wrapper')).hasClass('open');
      $(el.closest('.header-accordion-wrapper')).toggleClass('open');

      const accordionLabels = el.closest('.collapsible-item-container').querySelectorAll('.accordion-wrapper');
      for (const accordionLabel of accordionLabels) {
        isOpening ? $(accordionLabel).addClass('open') : $(accordionLabel).removeClass('open');
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

  _getItemsOfType(type) {
    const itemOfType = [];
    for (const item of this.actor.items) {
      if (item.type == type) {
        itemOfType.push(item);
      }
    }

    return itemOfType
  }


/**
* Handle clicking the transform button
* @private
*/
  async _transform() {
    const altModes = [];
    altModes =await this._getItemsOfType("altMode");

    if (!altModes.length && !this.actor.system.isTransformed) { // No alt-modes to transform into
      ui.notifications.warn(game.i18n.localize('E20.AltModeNone'));
    } else if (altModes.length > 1) {                           // Select from multiple alt-modes
      if (!this.actor.system.isTransformed) {
        this._showAltModeChoiceDialog(altModes, false);         // More than 1 altMode and not transformed
      } else {
        this._showAltModeChoiceDialog(altModes, true);          // More than 1 altMode and transformed
      }
    } else {                                                    // Alt-mode/bot-mode toggle
      this.actor.system.isTransformed ? this._transformBotMode() : this._transformAltMode(altModes[0]);
    }
  }
  /**
   * Creates the Alt Mode Choice List Dialog
   * @param {AltMode[]} altModes  A list of the available Alt Modes
   * @param {Boolean} isTransformed Whether the Transformer is transformed or not
   * @private
   */
  async _showAltModeChoiceDialog(altModes, isTransformed) {
    const choices = {};
    if (isTransformed) {
      choices["BotMode"] = {
        chosen: false,
        label: "BotMode",
      }
    }

    for (const altMode of altModes) {
      if (this.actor.system.altModeId != altMode._id) {
        choices[altMode._id] = {
          chosen: false,
          label: altMode.name,
        }
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.AltModeChoice'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._altModeSelect(altModes, this._rememberOptions(html)),
          }
        },
      },
    ).render(true);
  }

  /**
   * Handle selecting an alt-mode from the Alt-mode Dialog
   * @param {AltMode[]} altModes  A list of the available Alt Modes
   * @param {Object} options   The options resulting from _showAltModeDialog()
   * @private
   */
  async _altModeSelect(altModes, options) {
    let selectedForm = null;
    let transformation = null;

    for (const [altMode, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedForm = altMode;
        break;
      }
    }

    if (!selectedForm) {
      return;
    }

    if (selectedForm == "BotMode") {
      this._transformBotMode();
    } else {
      for (const mode of altModes) {
        if (selectedForm == mode._id) {
          transformation = mode;
          break;
        }
      }

      if (transformation) {
        this._transformAltMode(transformation);
      }
    }
  }

  /**
   * Handles Transforming into an altMode
   * @param {AltMode} altMode   The alt-mode that was selected to Transform into
   * @private
   */
  async _transformAltMode(altMode) {
    await this.actor.update({
      "system.movement.aerial.altMode": altMode.system.altModeMovement.aerial,
      "system.movement.swim.altMode": altMode.system.altModeMovement.aquatic,
      "system.movement.ground.altMode": altMode.system.altModeMovement.ground,
      "system.altModeSize": altMode.system.altModesize,
      "system.altModeId": altMode._id,
      "system.isTransformed": true,
    }).then(this.render(false));
  }

  /**
   * Handle Transforming back into the Bot Mode
   * @private
   */
  async _transformBotMode() {
    await this.actor.update({
      "system.movement.aerial.altMode": 0,
      "system.movement.swim.altMode": 0,
      "system.movement.ground.altMode": 0,
      "system.isTransformed": false,
      "system.altModeId": "",
      "system.altModeSize": "",
    }).then(this.render(false));
  }

  /**
   * Handle returning a list of AltModes
   * @private
   */
  async _getAltModes() {
    const altModes = [];
    altModes = await this._getItemsOfType("altMode");

    return altModes;
  }

    /**
   * Handle AltModes being deleted
   * @param {AltMode} altMode is the deleted AltMode.
   * @private
   */
  async _onAltModeDelete(altMode) {
    const altModes = this._getAltModes();
    if (altModes.length > 1) {
      if (altMode._id == this.actor.system.altModeId) {
        this._transformBotMode();
      }
    } else {
      this._transformBotMode();
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

  // Handle setting the isMorphed value
  async _morph() {
    await this.actor.update({
      "system.isMorphed": !this.actor.system.isMorphed,
    }).then(this.render(false));
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

    switch (sourceItem.type) {
      case 'influence':
        await this._influenceUpdate(sourceItem, event, data)
        break;
      case 'origin':
        for (let actorItem of this.actor.items) {
          // Characters can only have one Origin
          if(actorItem.type == 'origin') {
            ui.notifications.error(game.i18n.format(game.i18n.localize('E20.MulitpleOriginError')));
            return false;
          }
        }

        await this._showOriginEssenceDialog(sourceItem, event, data);
        break;
      case 'upgrade':
        // Drones can only accept drone Upgrades
        if (this.actor.type == 'companion' && this.actor.system.type == 'drone' && sourceItem.system.type != 'drone') {
          ui.notifications.error(game.i18n.format(game.i18n.localize('E20.UpgradeDroneError')));
          return false;
        } else if (this.actor.type == 'transformer' && sourceItem.system.type != 'armor') {
          ui.notifications.error(game.i18n.format(game.i18n.localize('E20.UpgradeTransformerError')));
          return false;
        }
      default:
        super._onDropItem(event, data);
    }
  };

  /**
   * Handle the dropping of an influence on to a character
   * @param {Object} influence    The Influence
   * @param {DragEvent} event  The concluding DragEvent which contains drop data
   * @param {object} data      The data transfer extracted from the event
   * @private
   */
  async _influenceUpdate(sourceItem, event, data) {
    let addHangUp = false;

    for(const item of this.actor.items) {
      if (item.type == 'influence') {
        addHangUp = true;
        break
      }
    }

    const newInfluenceList = await super._onDropItem(event, data);
    const newInfluence = newInfluenceList[0]
    const perkIds = await this._createItemCopies(sourceItem.system.influencePerkIds);
    let hangUpIds = [];
    if (addHangUp) {
      if (sourceItem.system.hangUpIds.length > 1) {
        this._chooseHangUp(sourceItem, perkIds, newInfluence)
      } else {
        hangUpIds = await this._createItemCopies(sourceItem.system.hangUpIds);
        await newInfluence.update({
          ["system.influencePerkIds"]: perkIds,
          ["system.hangUpIds"]: hangUpIds
        });
      }
    }
    await newInfluence.update({
      ["system.influencePerkIds"]: perkIds
    });
  }

  /**
  * Displays a dialog for selecting a Hang Up from an Influence
  * @param {Object} influence  The Influence
  * @private
  */
  async _chooseHangUp(sourceItem, perkIds, newInfluence) {
    const choices = {};
    let compendiumData = ""
    for (const id of sourceItem.system.hangUpIds) {
      compendiumData = game.items.get(id);
      if(!compendiumData) {
        compendiumData = searchCompendium(id);
        if (compendiumData) {
          choices[compendiumData._id] = {
            chosen: false,
            label: compendiumData.name,
          }
        }
      }

    }

    new Dialog(
      {
        title: game.i18n.localize('E20.HangUpChoice'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => this._hangUpSelect(compendiumData, this._rememberOptions(html), perkIds, newInfluence),
          }
        },
      },
    ).render(true);
  }

  async _hangUpSelect(compendiumData, options, perkIds, newInfluence) {
    let selectedHangUp = null;
    const hangUpIds = []
    for (const [hangUp, isSelected] of Object.entries(options)) {
      if (isSelected) {
        selectedHangUp = hangUp;
        break;
      }
    }

    if (!selectedHangUp) {
      return;
    }
    const newHangUp = await Item.create(compendiumData, { parent: this.actor });
    hangUpIds.push(newHangUp._id);
    await newInfluence.update({
      ["system.influencePerkIds"]: perkIds,
      ["system.hangUpIds"]: hangUpIds
    });

  }

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
    const influences = await this._getItemsOfType("influence");
    for (const influence of influences) {
      if (influence.system.influenceSkill) {
        for (const skill in this.actor.system.skills) {

          if (skill == influence.system.influenceSkill) {
            for (const influenceEssence in this.actor.system.skills[skill].essences) {
              if (this.actor.system.skills[skill].essences[influenceEssence] == true) {
                choices[influenceEssence] = {
                  chosen: false,
                  label: CONFIG.E20.originEssences[influenceEssence],
                }
              }
            }
          }
        }
      }
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.EssenceIncrease'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
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

    const influences = await this._getItemsOfType("influence");
    for (const influence of influences) {
      if (influence.system.influenceSkill) {
        const essence = CONFIG.E20.skillToEssence[influence.system.influenceSkill];
        if (options[essence] && essences.includes(essence)) {
          selectedEssence = essence;
          choices[influence.system.influenceSkill] = {
            chosen: false,
            label: CONFIG.E20.originSkills[influence.system.influenceSkill],
          };
        }
      }
    }

    if (!selectedEssence) {
      ui.notifications.warn(game.i18n.localize('E20.OriginSelectNoEssence'));
      return;
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.OriginBonusSkill'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
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

    const newOrigin = await super._onDropItem(event, data);
    this._originPerkCreate(origin, newOrigin)

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
   * Creates copies of Items for given IDs
   * @param {String[]} ids  The IDs of the items to be copied
   * @returns {String[]}    The IDs of the copied items
   * @private
   */
  async _createItemCopies(ids) {
    const copyIds = [];

    for (const id of ids) {
      let compendiumData = game.items.get(id);
      if(!compendiumData) {
        const item = searchCompendium(id);
        if (item) {
          compendiumData = item;
        }
      }

      const newItem = await Item.create(compendiumData, { parent: this.actor });
      copyIds.push(newItem._id);
    }

    return copyIds;
  }

  /**
  * Creates the Perk from the Origin on the Actor
  * @param {Object} origin   The Origin
  * @private
  */
  async _originPerkCreate(origin, newOriginList){
    const newOrigin = newOriginList[0]
    const perkIds = [];
    for (const id of origin.system.originPerkIds) {
      let data = game.items.get(id);
      if(!data) {
        data = searchCompendium(id)
      }

      const perk = await Item.create(data, { parent: this.actor });
      perkIds.push(perk._id);
    }

    await newOrigin.update({
      ["system.originPerkIds"]: perkIds
    });
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
  * Handle deleting of an Influence from an Actor Sheet
  * @param {Object} influence   The Influence
  * @private
  */
  _onInfluenceDelete (influence) {
    const influenceDelete = this.actor.items.get(influence._id)

    for (const perk of influenceDelete.system.influencePerkIds) {
      if(perk){
        this._itemDeleteById(perk)
      }
    }
    for (const hangUp of influenceDelete.system.hangUpIds) {
      this._itemDeleteById(hangUp)
    }
  }

  _itemDeleteById(id) {
    let item = this.actor.items.get(id)
    if(item){
      item.delete()
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

    const originDelete = this.actor.items.get(origin._id)

    for (const perk of originDelete.system.originPerkIds) {
      this._itemDeleteById(perk)
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
