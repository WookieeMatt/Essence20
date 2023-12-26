import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { deleteAttachmentsForItem, checkIsLocked, createItemCopies, parseId } from "../helpers/utils.mjs";
import { AdvancementHandler } from "../sheet-handlers/advancement-handler.mjs";
import { AlterationHandler } from "../sheet-handlers/alteration-handler.mjs";
import { BackgroundHandler } from "../sheet-handlers/background-handler.mjs";
import { CrossoverHandler } from "../sheet-handlers/crossover-handler.mjs";
import { PowerRangerHandler } from "../sheet-handlers/power-ranger-handler.mjs";
import { AttachmentHandler } from "../sheet-handlers/attachment-handler.mjs";
import { TransformerHandler } from "../sheet-handlers/transformer-handler.mjs";
import { PowerHandler } from "../sheet-handlers/power-handler.mjs";
import { PerkHandler } from "../sheet-handlers/perk-handler.mjs";
import { RoleHandler } from "../sheet-handlers/role-handler.mjs";

export class Essence20ActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);

    this._accordionStates = { skills: '' };
    this._advHandler = new AdvancementHandler(this);
    this._alHandler = new AlterationHandler(this);
    this._bgHandler = new BackgroundHandler(this);
    this._coHandler = new CrossoverHandler(this);
    this._prHandler = new PowerRangerHandler(this);
    this._atHandler = new AttachmentHandler(this);
    this._tfHandler = new TransformerHandler(this);
    this._pwHandler = new PowerHandler(this);
    this._pkHandler = new PerkHandler(this);
    this._rlHandler = new RoleHandler(this);
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

    // Prepare number of actions
    if (['giJoe', 'npc', 'pony', 'powerRanger', 'transformer'].includes(actorData.type)) {
      this._prepareNumActions(context);
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
      case 'trait':
        traits.push(i);
        break;
      case 'upgrade':
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
      const childItem = this.actor.items.get(id) || game.items.get(id);
      if (childItem) {
        childItems.push(childItem);
      }
    }

    return childItems;
  }

  /**
   * Prepare the number of actions available for the actor.
   * @param {Object} context The actor data to prepare.
   * @return {undefined}
   */
  _prepareNumActions(context) {
    const speed = this.actor.system.essences.speed;

    context.numActions = {
      free: Math.max(0, speed - 2),
      movement: speed > 0 ? 1 : 0,
      standard: speed > 1 ? 1 : 0,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId) || game.items.get(itemId);
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

    // Transform Button
    html.find('.transform').click(() => this._tfHandler.onTransform(this));

    // Level Change
    html.find('.level').change(this._advHandler.onLevelChange(this.actor));

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

    // Rest button
    html.find('.rest').click(() => this._onRest());

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
   * Handle clicking the rest button.
   * @private
   */
  async _onRest() {
    const normalEnergon = this.actor.system.energon.normal;
    const maxEnergonRestore = Math.ceil(normalEnergon.max / 2);
    const energonRestore = Math.min(normalEnergon.max, normalEnergon.value + maxEnergonRestore);

    // Notifications for resetting Energon types
    if (this.actor.system.canTransform) {
      let energonsReset = [];

      const actorEnergons = this.actor.system.energon;
      for (const actorEnergon of Object.keys(actorEnergons)) {
        if (actorEnergons[actorEnergon].value) {
          energonsReset.push(game.i18n.localize(CONFIG.E20.energonTypes[actorEnergon]));
        }
      }

      if (energonsReset.length) {
        ui.notifications.info(
          game.i18n.format(
            'E20.RestEnergonReset',
            {energon: energonsReset.join(", ")},
          ),
        );
      }

      ui.notifications.info(`Energon restored by ${energonRestore}.`);
    }

    ui.notifications.info("Health restored and stun reset.");
    ui.notifications.info("Rest complete!");

    await this.actor.update({
      "system.health.value": this.actor.system.health.max,
      "system.stun.value": 0,
      "system.energon.normal.value": energonRestore,
      "system.energon.dark.value": 0,
      "system.energon.primal.value": 0,
      "system.energon.red.value": 0,
      "system.energon.synthEn.value": 0,
    }).then(this.render(false));
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
      let keyId = element.closest('.item').dataset.itemKey;
      const itemId = element.closest('.item').dataset.itemId || element.closest('.item').dataset.parentId;
      const item = this.actor.items.get(itemId);

      if (rollType == 'power') {
        await this._pwHandler.powerCost(item);
      } else if (rollType == 'classFeature') {
        // If a Class Feature is being used, decrement uses
        await item.update({ 'system.uses.value': Math.max(0, item.system.uses.value - 1) });
      }

      if (item) {
        if (keyId) {
          return item.roll(dataset, keyId);
        } else {
          return item.roll(dataset);
        }
      }
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();

    if (checkIsLocked(this.actor)) {
      return;
    }

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
    if (checkIsLocked(this.actor)) {
      return;
    }

    let item = null;
    const li = $(event.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const parentId = li.data("parentId");
    const parentItem = this.actor.items.get(parentId);

    if (itemId) {
      item = this.actor.items.get(itemId);
    } else {
      const keyId = li.data("itemKey");

      // If the deleted item is attached to another item find what it is attached to.
      for (const attachedItem of this.actor.items) {
        const collectionId = await attachedItem.getFlag('essence20', 'collectionId');
        if (collectionId) {
          if (keyId == collectionId) {
            item = attachedItem;
          }
        }
      }
    }

    // Check if this item has a parent item, such as for deleting an upgrade from a weapon
    if (parentItem) {
      const id = li.data("itemKey");
      const updateString = `system.items.-=${id}`;

      await parentItem.update({[updateString]: null});

      item.delete();
      li.slideUp(200, () => this.render(false));
    } else {
      if (item.type == "armor") {
        deleteAttachmentsForItem(item, this.actor);
      } else if (item.type == "origin") {
        this._bgHandler.onOriginDelete(item);
      } else if (item.type == 'influence') {
        deleteAttachmentsForItem(item, this.actor);
      } else if (item.type == "altMode") {
        this._tfHandler.onAltModeDelete(item, this);
      } else if (item.type == "alteration") {
        this._alHandler.onAlterationDelete(item);
      } else if (item.type == "perk") {
        this._pkHandler.onPerkDelete(item);
      } else if (item.type == "weapon") {
        deleteAttachmentsForItem(item, this.actor);
      }

      item.delete();
      li.slideUp(200, () => this.render(false));
    }
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

    if (checkIsLocked(this.actor)) {
      return;
    }

    const sourceItem = await fromUuid(data.uuid);
    if (!sourceItem) return false;

    // Don't drop a new item if they're just sorting
    if (this.actor.uuid === sourceItem?.parent?.uuid) {
      return await this._onDropDefault(event, data, false);
    }

    switch (sourceItem.type) {
    case 'alteration':
      return await this._alHandler.alterationUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'armor':
      return await this._atHandler.gearDrop(sourceItem, super._onDropItem.bind(this, event, data));
    case 'influence':
      return await this._bgHandler.influenceUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'origin':
      return await this._bgHandler.originUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'perk':
      return await this._pkHandler.perkUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'power':
      return await this._pwHandler.powerUpdate(sourceItem, super._onDropItem.bind(this, event, data));
    case 'upgrade':
      return await this._onDropUpgrade(sourceItem, event, data);
    case 'weapon':
      return await this._atHandler.gearDrop(sourceItem, super._onDropItem.bind(this, event, data));
    case 'weaponEffect':
      return this._atHandler.attachItem(sourceItem);

    default:
      return await super._onDropItem(event, data);
    }
  }

  /**
   * Handle dropping of an Upgrade onto an Actor sheet
   * @param {Upgrade} upgrade           The upgrade
   * @param {DragEvent} event           The concluding DragEvent which contains drop data
   * @param {Object} data               The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   */
  async _onDropUpgrade(upgrade, event, data) {
    // Drones can only accept drone Upgrades
    if (this.actor.type == 'companion' && this.actor.system.type == 'drone' && upgrade.system.type == 'drone') {
      return super._onDropItem(event, data);
    } else if (this.actor.system.canTransform && upgrade.system.type == 'armor') {
      return super._onDropItem(event, data);
    } else if (['armor', 'weapon'].includes(upgrade.system.type)) {
      return this._atHandler.attachItem(upgrade);
    } else {
      ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
      return false;
    }
  }

  /**
   * Handle dropping of any other item an Actor sheet
   * @param {DragEvent} event           The concluding DragEvent which contains drop data
   * @param {Object} data               The data transfer extracted from the event
   * @param {Boolean} isNewItem         Whether a new item is intended to be dropped
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   */
  async _onDropDefault(event, data, isNewItem=true) {
    // Drones can only accept drone Upgrades
    const itemUuid = await parseId(data.uuid);

    let droppedItemList = await super._onDropItem(event, data);

    if (isNewItem) {
      const newItem = droppedItemList[0];
      await newItem.update ({
        "system.originalId": itemUuid,
      });
    } else {
      droppedItemList = [];
    }

    return droppedItemList;
  }

  /**
   * Handle dropping of a Weapon onto an Actor sheet
   * @param {DragEvent} event           The concluding DragEvent which contains drop data
   * @param {Object} data               The data transfer extracted from the event
   * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
   *                                    not permitted.
   */
  async _onDropWeapon(event, data) {
    const weaponList = await super._onDropItem(event, data);
    const newWeapon = weaponList[0];
    const oldWeaponEffectIds = newWeapon.system.weaponEffectIds;
    const newWeaponEffectIds = await createItemCopies(oldWeaponEffectIds, this.actor);
    await newWeapon.update({ ['system.weaponEffectIds']: newWeaponEffectIds });
    return weaponList;
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
