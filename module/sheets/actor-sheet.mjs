import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { createItemCopies, searchCompendium } from "../helpers/utils.mjs";
import { AlterationHandler } from "../sheet-handlers/alteration-handler.mjs";
import { BackgroundHandler } from "../sheet-handlers/background-handler.mjs";
import { CrossoverHandler } from "../sheet-handlers/crossover-handler.mjs";
import { PowerRangerHandler } from "../sheet-handlers/power-ranger-handler.mjs";
import { AttachmentHandler } from "../sheet-handlers/attachment-handler.mjs";
import { TransformerHandler } from "../sheet-handlers/transformer-handler.mjs";

export class Essence20ActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);

    this._accordionStates = { skills: '' };
    this._alHandler = new AlterationHandler(this);
    this._bgHandler = new BackgroundHandler(this);
    this._coHandler = new CrossoverHandler(this);
    this._prHandler = new PowerRangerHandler(this);
    this._atHandler = new AttachmentHandler(this);
    this._tfHandler = new TransformerHandler(this);
  }

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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
    if (['npc', 'zord', 'megaformZord', 'vehicle', 'companion'].includes(actorData.type)) {
      this._prepareDisplayedNpcSkills(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    // Prepare Zords for MFZs
    this._prHandler.prepareZords(context);

    context.accordionStates = this._accordionStates;
    context.canMorphOrTransform = context.actor.system.canMorph || context.actor.system.canTransform;

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
            onclick: (ev) => this._coHandler.showCrossoverOptions(ev, this),
          },
          ...buttons,
        ];
      }
    }

    return buttons;
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
    const traits = []; // Used by Vehicles
    const weapons = [];
    const classFeaturesById = {};
    let equippedArmorEvasion = 0;
    let equippedArmorToughness = 0;

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
          equippedArmorEvasion += parseInt(i.system.bonusEvasion);
          equippedArmorToughness += parseInt(i.system.bonusToughness);
        }

        i.upgrades = this._populateChildItems(i.system.upgradeIds);
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
        {
          const skill = i.system.skill;
          const existingSkillSpecializations = specializations[skill];
          existingSkillSpecializations ? specializations[skill].push(i) : specializations[skill] = [i];
        }

        break;
      case 'threatPower':
        threatPowers.push(i);
        break;
      case 'trait':
        traits.push(i);
        break;
      case 'upgrade':
        upgrades.push(i);
        break;
      case 'weapon':
        i.upgrades = this._populateChildItems(i.system.upgradeIds);
        i.weaponEffects = this._populateChildItems(i.system.weaponEffectIds);
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
    context.traits = traits;
    context.upgrades = upgrades;
    context.weapons = weapons;

    this.actor.update({
      "system.defenses.evasion.armor": equippedArmorEvasion,
      "system.defenses.toughness.armor": equippedArmorToughness,
    }).then(this.render(false));
  }

  /**
   * Returns the upgrades associated with the given Item
   * @param {Item} item The item to fetch upgrades for
   * @returns {Promise<Upgrade[]>} The upgrades associated with the given Item
   * @private
   */
  _populateChildItems(childItemIds) {
    const childItems = [];

    for (const id of childItemIds) {
      const childItem = this.actor.items.get(id) || game.items.get(id) || searchCompendium(id);
      if (childItem) {
        childItems.push(childItem);
      }
    }

    return childItems;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId) || game.items.get(itemId) || searchCompendium(itemId);
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(this._onItemDelete.bind(this));

    // Delete Zord from MFZ
    html.find('.zord-delete').click(ev => this._prHandler.onZordDelete(ev));

    // Edit specialization name inline
    html.find(".inline-edit").change(this._onInlineEdit.bind(this));

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Morph Button
    html.find('.morph').click(() => this._prHandler.onMorph());

    //Transform Button
    html.find('.transform').click(() => this._tfHandler.onTransform(this));

    // Rollable abilities.
    if (this.actor.isOwner) {
      html.find('.rollable').click(this._onRoll.bind(this));
    }

    // Open and collapse Item content
    html.find('.accordion-label').click(this._onToggleAccordion.bind(this));

    // Open and collapse all Item contents in container
    html.find('.header-accordion-label').click(this._onToggleHeaderAccordion.bind(this));

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
   * Handle toggling accordion container headers.
   * @param {Event} event The originating click event
   * @private
   */
  async _onToggleHeaderAccordion(event) {
    const el = event.currentTarget;
    const isOpening = !$(el.closest('.header-accordion-wrapper')).hasClass('open');
    $(el.closest('.header-accordion-wrapper')).toggleClass('open');

    const accordionLabels = el.closest('.collapsible-item-container').querySelectorAll('.accordion-wrapper');
    for (const accordionLabel of accordionLabels) {
      isOpening ? $(accordionLabel).addClass('open') : $(accordionLabel).removeClass('open');
    }
  }

  /**
   * Handle toggling accordion containers.
   * @param {Event} event The originating click event
   * @private
   */
  async _onToggleAccordion(event) {
    const el = event.currentTarget;
    const parent = $(el).closest('.accordion-wrapper');

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
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event The originating click event
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
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event The originating click event
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
      data: data,
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Set the parent item type for nested items
    if (data.parentId) {
      const parentItem = this.actor.items.get(data.parentId);
      itemData.data.type = parentItem.type;
    }

    // Finally, create the item!
    const newItem = await Item.create(itemData, { parent: this.actor });

    // Update parent item's ID list for nested items
    if (data.parentId) {
      const parentItem = this.actor.items.get(data.parentId);

      if (newItem.type == 'upgrade' && ['armor', 'weapon'].includes(parentItem.type)) {
        this._addChildItemToParent(parentItem, newItem, "upgradeIds");
      } else if (newItem.type == 'weaponEffect' && parentItem.type == 'weapon') {
        this._addChildItemToParent(parentItem, newItem, "weaponEffectIds");
      }
    }
  }

  /**
  * Adds the given child Item's ID to its parent's ID list
  * @param {Item} parent      The parent Item
  * @param {Item} child       The child Item
  * @param {String} listName  The name of the parent's ID list
  * @private
  */
  async _addChildItemToParent(parent, child, listName) {
    const ids = parent.system[listName];
    ids.push(child._id);
    await parent.update({ [`system.${listName}`]: ids });
  }

  /**
  * Handle deleting Items
  * @param {Event} event The originating click event
  * @private
  */
  async _onItemDelete(event) {
    const li = $(event.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const parentId = li.data("parentId");

    // Check if this item has a parent item, such as for deleting an upgrade from a weapon
    const parentItem = this.actor.items.get(parentId);
    if (parentItem) {
      if (['armor', 'weapon'].includes(parentItem.type)) {
        const remainingUpgradeIds = parentItem.system.upgradeIds.filter(u => u != itemId);
        await parentItem.update({ ["system.upgradeIds"]: remainingUpgradeIds });
      }
    }

    const item = this.actor.items.get(itemId);

    if (item.type == "origin") {
      this._bgHandler.onOriginDelete(item);
    } else if (item.type == 'influence') {
      this._bgHandler.onInfluenceDelete(item);
    } else if (item.type == "altMode") {
      this._tfHandler.onAltModeDelete(item, this);
    } else if (item.type == "alteration") {
      this._alHandler._onAlterationDelete(item);
    }

    item.delete();
    li.slideUp(200, () => this.render(false));
  }

  /**
   * Handle editing specialization names inline
   * @param {Event} event The originating click event
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
   * Handle dropping an Item onto an Actor.
   * @param {DragEvent} event           The concluding DragEvent which contains drop data
   * @param {Object} data               The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   * @override
   */
  async _onDropItem(event, data) {
    if (data.type != 'Item') {
      return;
    }

    const sourceItem = await fromUuid(data.uuid);
    if (!sourceItem) return false;

    switch (sourceItem.type) {
    case 'alteration':
      return await this._alHandler.alterationUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'influence':
      return await this._bgHandler.influenceUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'origin':
      return await this._bgHandler.originUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'upgrade':
      // Drones can only accept drone Upgrades
      if (this.actor.type == 'companion' && this.actor.system.type == 'drone' && sourceItem.system.type == 'drone') {
        return super._onDropItem(event, data);
      } else if (this.actor.system.canTransform && sourceItem.system.type == 'armor') {
        return super._onDropItem(event, data);
      } else if (['armor', 'weapon'].includes(sourceItem.system.type)) {
        return this._atHandler.attachItem(sourceItem.system.type, super._onDropItem.bind(this, event, data));
      } else {
        ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
        return false;
      }
    case 'weapon':
      const weaponList = await super._onDropItem(event, data);
      const newWeapon = weaponList[0];
      const oldWeaponEffectIds = newWeapon.system.weaponEffectIds;
      const newWeaponEffectIds = await createItemCopies(oldWeaponEffectIds, this.actor);
      await newWeapon.update({ ['system.weaponEffectIds']: newWeaponEffectIds });
      return weaponList;
    case 'weaponEffect':
      return this._atHandler.attachItem('weapon', super._onDropItem.bind(this, event, data));
    default:
      return super._onDropItem(event, data);
    }
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event           The concluding DragEvent which contains drop data
   * @param {Object} data               The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
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
          "system.zordIds": zordIds,
        }).then(this.render(false));
      }
    } else {
      return false;
    }
  }
}
