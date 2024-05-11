import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { checkIsLocked, getNumActions } from "../helpers/actor.mjs";
import { deleteAttachmentsForItem, setEntryAndAddItem } from "../helpers/utils.mjs";
import { onLevelChange } from "../sheet-handlers/advancement-handler.mjs";
import { onAlterationDelete } from "../sheet-handlers/alteration-handler.mjs";
import { onOriginDelete } from "../sheet-handlers/background-handler.mjs";
import { showCrossoverOptions } from "../sheet-handlers/crossover-handler.mjs";
import { prepareZords, onZordDelete, onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onFocusDelete, onRoleDelete } from "../sheet-handlers/role-handler.mjs";
import { onAltModeDelete, onTransform } from "../sheet-handlers/transformer-handler.mjs";
import { onPerkDelete } from "../sheet-handlers/perk-handler.mjs";
import { onRest, onRoll } from "../sheet-handlers/listener-misc-handler.mjs";
import { onDropActor, onDropItem } from "../sheet-handlers/drop-handler.mjs";

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
      context.numActions = getNumActions(this.actor);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    // Prepare Zords for MFZs
    prepareZords(this.actor, context);

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
    const specializations = {};
    const spells = [];
    const upgrades = [];
    const traits = []; // Used by Vehicles
    const weapons = [];
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
    html.find('.item-edit').click(this._onItemEdit.bind(this));

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(this._onItemDelete.bind(this));

    // Delete Zord from MFZ
    html.find('.zord-delete').click(ev => onZordDelete(this, ev));

    // Edit specialization name inline
    html.find(".inline-edit").change(this._onInlineEdit.bind(this));

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
    let parentItem = null;
    if (data.parentId) {
      parentItem = this.actor.items.get(data.parentId);
      itemData.data.type = parentItem.type;
    }

    // Finally, create the item!
    const newItem = await Item.create(itemData, { parent: this.actor });

    if (parentItem) {
      newItem.setFlag('essence20', 'parentId', parentItem._id);

      let key = null;

      // Update parent item's ID list for upgrades and weapon effects
      if (newItem.type == 'upgrade' && ['armor', 'weapon'].includes(parentItem.type)) {
        key = await setEntryAndAddItem(newItem, parentItem);
      } else if (newItem.type == 'weaponEffect' && parentItem.type == 'weapon') {
        key = await setEntryAndAddItem(newItem, parentItem);
      }

      newItem.setFlag('essence20', 'collectionId', key);
    }
  }

  /**
   * Handle editing an owned Item for the actor
   * @param {Event} event The originating click event
   * @private
   */
  async _onItemEdit(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest(".item");
    let item = null;

    const itemId = li.data("itemId");
    if (itemId) {
      item = this.actor.items.get(itemId) || game.items.get(itemId);
    } else {
      const itemUuid = li.data("itemUuid");
      item = await fromUuid(itemUuid);
    }

    if (item) {
      item.sheet.render(true);
    }
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

    // return if no item is found.
    if (!item) {
      return;
    }

    // Confirmation dialog
    const confirmation = await this._getItemDeleteConfirmDialog(item);
    if (confirmation.cancelled) {
      return;
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
        onOriginDelete(this.actor, item);
      } else if (item.type == 'influence') {
        deleteAttachmentsForItem(item, this.actor);
      } else if (item.type == "altMode") {
        onAltModeDelete(this, item);
      } else if (item.type == "alteration") {
        onAlterationDelete(this.actor, item);
      } else if (item.type == "focus") {
        onFocusDelete(this.actor, item);
      } else if (item.type == "perk") {
        onPerkDelete(this.actor, item);
      } else if (item.type == "role") {
        onRoleDelete(this.actor, item);
      } else if (item.type == "weapon") {
        deleteAttachmentsForItem(item, this.actor);
      }

      item.delete();
      li.slideUp(200, () => this.render(false));
    }
  }

  /**
   * Displays the dialog used for confirming actor item deletion.
   * @param {Item} item           The item being deleted.
   * @returns {Promise<Dialog>}   The dialog to be displayed.
   */
  async _getItemDeleteConfirmDialog(item) {
    return new Promise(resolve => {
      const data = {
        title: game.i18n.localize("E20.ItemDeleteConfirmTitle"),
        content: `<p>${game.i18n.format("E20.ItemDeleteConfirmContent", {name: item.name})}</p>`,
        buttons: {
          normal: {
            label: game.i18n.localize('E20.DialogConfirmButton'),
            /* eslint-disable no-unused-vars */
            callback: html => resolve({ cancelled: false }),
          },
          cancel: {
            label: game.i18n.localize('E20.DialogCancelButton'),
            /* eslint-disable no-unused-vars */
            callback: html => resolve({ cancelled: true }),
          },
        },
        default: "normal",
        close: () => resolve({ cancelled: true }),
      };

      new Dialog(data, null).render(true);
    });
  }

  /**
   * Handle editing specialization names inline
   * @param {Event} event The originating click event
   * @private
   */
  async _onInlineEdit(event) {
    event.preventDefault();

    let item;
    let element = event.currentTarget;
    const dataset = element.closest(".item").dataset;
    const itemId = dataset.itemId;
    const itemUuid = dataset.itemUuid;
    const parentId = dataset.parentId;
    const newValue = element.type == 'checkbox' ? element.checked : element.value;

    // If a child item is being updated, update the parent's copy too
    if (!itemId && itemUuid && parentId) {
      item = await fromUuid(itemUuid);

      const parentItem = this.actor.items.get(parentId);
      const parentField = dataset.parentField;
      await parentItem.update({ [parentField]: newValue });
    } else {
      item = this.actor.items.get(itemId);
    }

    const field = element.dataset.field;
    return item.update({ [field]: newValue });
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
