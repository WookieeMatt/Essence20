const { HandlebarsApplicationMixin } = foundry.applications.api;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;

import SheetOptions from "../apps/sheet-options.mjs";
import StatEditor from "../apps/stat-editor.mjs";
import { applyThemeClass } from "../settings.js";
import {
  onCreateActiveEffect,
  onDeleteActiveEffect,
  onEditActiveEffect,
  onToggleActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";
import { applySystemActorsColorCssVariables, applySystemColorCssVariables, getNumActions } from "../helpers/actor.mjs";
import { onLevelChange } from "../sheet-handlers/role-handler.mjs";
import { prepareSystemActors,
  onCrewNumberUpdate,
  onSystemActorsDelete,
  onVehicleRoleUpdate,
} from "../sheet-handlers/vehicle-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransform } from "../sheet-handlers/transformer-handler.mjs";
import {
  onEditMorphToughnessBonus,
  onRecharge,
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
  onShieldActivationToggle,
  onShieldEquipToggle,
} from "../sheet-handlers/listener-item-handler.mjs";
import { onManageSelectTrait } from "../helpers/traits.mjs";

export class Essence20BaseActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  constructor(options) {
    super(options);
    this.accordionStates = { skills: '' };
  }

  static DEFAULT_OPTIONS = {
    actions: {
      bonusEdit: this.#onEditMorphToughnessBonus,
      createEffect: this.#createActiveEffect,
      deleteEffect: this.#deleteActiveEffect,
      editDefenses: this.#onEditDefenses,
      editEffect: this.#editActiveEffect,
      editSpeeds: this.#onEditSpeeds,
      inlineEdit: this.#onInlineEdit,
      itemCreate: this.#onItemCreate,
      itemDelete: this.#onItemDelete,
      itemEdit: this.#onItemEdit,
      levelDown: this.#onlevelDown,
      levelUp: this.#onLevelUp,
      morph: this.#onMorph,
      recharge: this.#onRecharge,
      rest: this.#onRest,
      rollable: this.#onRoll,
      sheetOptions: this.#onSheetOptions,
      shieldActivationToggle: this.#onShieldActivationToggle,
      shieldEquipToggle: this.#onShieldEquipToggle,
      systemActorsDelete: this.#onSystemActorsDelete,
      toggleAccordion: this.#toggleAccordion,
      toggleAccordionHeader: this.#toggleAccordionHeader,
      toggleEffect: this.#toggleActiveEffect,
      toggleLock: this.#onToggleLock,
      traitSelector: this.#onManageSelectTrait,
      transform: this.#onTransform,
    },
    classes: ["essence20", "sheet", "actor", "theme-wrapper"],
    tag: 'form',
    position: {
      width: 1050,
      height: 720,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    window: {
      resizable: true,
      controls: [
        {
          icon: "fas fa-cog",
          label: "E20.SheetOptions",
          action: "sheetOptions",
          visible: function () {
            return this.actor.isOwner && ["npc", "playerCharacter"].includes(this.actor.type);
          },
        },
      ],
    },
  };

  _onRender(context, options) {
    super._onRender(context, options);

    applyThemeClass(this.element);
    applySystemColorCssVariables(this.element, this.actor);
    applySystemActorsColorCssVariables(this.element);
    this._applyLockedState();
    this._activateMacroDragDrop();
    this._activateCrewListeners();
    this._activateInlineEditListeners();
  }

  /**
   * Reflect the actor's locked state in the DOM: readonly inputs, disabled selects, and the
   * lock/unlock icon. Re-run on every render since the actor's system.isLocked can change
   * (via the toggleLock action) and Foundry auto-re-renders the sheet after that update.
   */
  _applyLockedState() {
    const isLocked = this.actor.system.isLocked;

    for (const input of this.element.querySelectorAll('input')) {
      input.readOnly = isLocked;
    }

    // Health/stun current values stay editable even while locked; stun max stays locked always.
    for (const input of this.element.querySelectorAll('.no-lock')) {
      input.readOnly = false;
    }

    for (const input of this.element.querySelectorAll('.no-unlock')) {
      input.readOnly = true;
    }

    for (const select of this.element.querySelectorAll('select')) {
      select.disabled = isLocked;
    }

    this._applyTitlebarLockToggle(isLocked);
  }

  /**
   * Add a lock/unlock icon button to the far left of the window titlebar (matching the
   * position of similar toggles in other systems, e.g. dnd5e's prepared-spells toggle),
   * so the sheet can be locked/unlocked without needing to open the sheet body first. The
   * window frame is only built once (unlike the PARTS content, which re-renders), so this
   * inserts the button on first render and just updates its icon/tooltip afterward.
   */
  _applyTitlebarLockToggle(isLocked) {
    const header = this.element.querySelector('.window-header');
    if (!header) return;

    let button = header.querySelector('.header-lock-toggle');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'header-lock-toggle header-control icon';
      button.dataset.action = 'toggleLock';
      header.insertBefore(button, header.firstChild);
    }

    button.classList.toggle('fa-solid', true);
    button.classList.toggle('fa-lock', isLocked);
    button.classList.toggle('fa-lock-open', !isLocked);
    button.dataset.tooltip = game.i18n.localize(isLocked ? 'E20.ActorLockOn' : 'E20.ActorLockOff');
    button.setAttribute('aria-label', button.dataset.tooltip);
  }

  /**
   * Make item rows draggable onto the hotbar to create macros, matching the AppV1 sheets.
   */
  _activateMacroDragDrop() {
    if (!this.actor.isOwner) return;

    for (const li of this.element.querySelectorAll('li.item')) {
      if (li.classList.contains('inventory-header')) continue;
      li.setAttribute('draggable', true);
      li.addEventListener('dragstart', (event) => this._onDragStart(event), false);
    }
  }

  /**
   * Vehicle/zord crew role assignment (system-actors.hbs's .vehicle-role select and the
   * .num-crew driver/passenger count inputs) are change events, which AppV2's click-only
   * [data-action] delegation doesn't cover, so they need manual binding.
   */
  _activateCrewListeners() {
    for (const select of this.element.querySelectorAll('.vehicle-role')) {
      select.addEventListener('change', (event) => onVehicleRoleUpdate(event, this));
    }

    for (const input of this.element.querySelectorAll('.num-crew')) {
      input.addEventListener('change', (event) => onCrewNumberUpdate(event, this));
    }
  }

  /**
   * Elements marked class="inline-edit" (e.g. weapon-effects.hbs's per-effect Skill select) are
   * meant to write directly to a specific document field via data-field/data-parent-field
   * (handled by onInlineEdit), rather than through the sheet's normal actor-wide submitOnChange.
   * Like _activateCrewListeners above, this needs manual binding since these are change events
   * and AppV2's click-only [data-action] delegation doesn't cover those. Without this, the
   * select's change event was instead falling through to the sheet's ambient
   * submitOnChange form submission, which silently drops it since its name ("item.
   * classification.skill") isn't a real Actor schema path - the dropdown appeared to work but
   * never actually persisted, so rolls kept using the item's original skill.
   */
  _activateInlineEditListeners() {
    for (const element of this.element.querySelectorAll('.inline-edit')) {
      element.addEventListener('change', (event) => onInlineEdit(event, this.actor));
    }
  }


  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Make all the Essence20 consts accessible
    context.config = CONFIG.E20;

    // Use a safe clone of the actor data for further operations.
    const actorData = this.actor.toObject(false);

    // Add the actor's system data to context for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Roll data for TinyMCE/ProseMirror editors so inline rolls in text can resolve.
    context.rollData = this.actor.getRollData();

    if (['npc', 'zord', 'megaform', 'vehicle', 'companion'].includes(actorData.type)) {
      this._prepareDisplayedNpcSkills(context);
    }

    this._prepareItems(context);

    // Prepare WeaponEffect Skill List
    this._prepareWeaponEffectSkills(actorData, context);

    //Prepare Initiative Skills
    context.initiativeSkills = this._prepareInitiativeSkills(actorData);

    // Prepare number of actions - shown on every actor type's sidebar Speeds panel now,
    // not just Character's.
    context.numActions = getNumActions(this.actor);

    // Prepare actors that are attached to other actors
    prepareSystemActors(this.document, context);

    context.accordionStates = this.accordionStates;
    context.canMorphOrTransform = context.document.system.canMorph || context.document.system.canTransform;

    return context;
  }

  /**
   * Shared per-PART context prep for the "effects" and "notes" tabs, which are identical
   * across every actor type that has them. Subclasses with additional PARTS should call
   * `super._preparePartContext(partId, context, options)` first and extend the switch for
   * their own type-specific parts.
   */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    switch (partId) {
    case "effects": context = await this._prepareEffectsContext(context); break;
    case "notes": context = await this._prepareNotesContext(context); break;
    }

    return context;
  }

  async _prepareEffectsContext(context) {
    context.effects = prepareActiveEffectCategories(this.document.effects);
    return context;
  }

  async _prepareNotesContext(context) {
    return context;
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

  _prepareWeaponEffectSkills(actorData, context) {
    let hasSkillDie = false;
    let skillDieName = null;
    const items = actorData.items.documentsByType?.role;
    if (items?.length && items[0].system.skillDie.isUsed) {
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

  _prepareInitiativeSkills(actorData) {
    const initiativeSkills = {};
    for (const skill of Object.keys(actorData.system.skills)) {
      if (actorData.system.skills[skill].canBeInitiative) {
        initiativeSkills[skill] = {
          key: skill,
          label: game.i18n.localize(CONFIG.E20.skills[skill]),
        };
      }
    }

    return initiativeSkills;
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
    const features = []; // Used by Zords
    const focuses = [];
    const gears = [];
    const hangUps = [];
    const influences = [];
    const magicBaubles = [];
    const megaformTraits = [];
    const origins = []; // Used by PCs
    const perks = { all: [] }; // Used by PCs
    const powers = []; // Used by PCs
    let shieldEquipped = false;
    const shields = [];
    const specializations = {};
    const spells = [];
    const upgrades = [];
    const traits = []; // Used by Vehicles
    const weapons = [];
    let equippedArmorEvasion = 0;
    let equippedArmorToughness = 0;
    let faction = null;
    const roles = [];
    const rolePointsList = [];

    // Iterate through items, allocating to containers
    for (let i of context.document.items) {
      i.img = i.img || DEFAULT_TOKEN;
      const itemType = i.type;

      // Items granted by a Role/Focus/Origin/Influence/etc. record the level they were
      // granted at on the granting item's own system.items map, not on the granted item
      // itself - look it up via the parentId/collectionId flags createItemCopies() sets, so
      // leveled item lists (Perks, Spells, Background, Powers, Gear) can show a level number
      // without duplicating that data onto every item. Items that were never granted this way
      // (dropped directly, or types createItemCopies never grants) simply have no parentId and
      // resolve to null here, which the templates treat as "no badge".
      {
        const parentId = i.getFlag('essence20', 'parentId');
        const collectionId = i.getFlag('essence20', 'collectionId');
        const parent = parentId ? this.actor.items.get(parentId) : null;
        i.system.grantedLevel = parent?.system.items?.[collectionId]?.level ?? null;
      }

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
      case 'faction':
        faction = i;
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
        if (perks[i.system.type]) {
          perks[i.system.type].push(i);
        } else {
          perks[i.system.type] = [i];
        }

        // Makes a single list of all perks for NPCs and companions, instead of grouping by type
        // Don't add contact perks from the NPC as those are to be transferred to the actor that the contact is dropped on
        if (['npc', 'companion'].includes(this.actor.type) && i.system.type != 'contact') {
          perks.all.push(i);
        }

        break;
      case 'power':
        powers.push(i);
        break;
      case 'shield':
        if (i.system.equipped) {
          shieldEquipped = true;
        }

        shields.push(i);
        break;
      case 'spell':
        spells.push(i);
        break;
      case 'rolePoints':
        rolePointsList.push(i);

        {
          const defenseLetters = [];

          if (i.system.bonus.defenseBonus.cleverness) {
            defenseLetters.push('C');
          }

          if (i.system.bonus.defenseBonus.evasion) {
            defenseLetters.push('E');
          }

          if (i.system.bonus.defenseBonus.toughness) {
            defenseLetters.push('T');
          }

          if (i.system.bonus.defenseBonus.willpower) {
            defenseLetters.push('W');
          }

          i.system.bonus.defenseBonus.string = defenseLetters.join(', ');
          i.system.isSpendable = !!(i.system.resource.max || i.system.powerCost);
        }

        break;
      case 'role':
        roles.push(i);
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

    // Items granted at a specific level (grantedLevel, set above) list in ascending level
    // order, so the Perks/Spells/Background/Powers/Gear tabs read top-to-bottom like a level
    // progression instead of actor.items' arbitrary insertion order. Items without a level
    // (player-picked perks, directly-dropped gear, etc.) sort as equal and keep their existing
    // order (Array#sort is stable).
    const byGrantedLevel = (a, b) => (a.system.grantedLevel ?? Infinity) - (b.system.grantedLevel ?? Infinity);
    for (const perkList of Object.values(perks)) {
      perkList.sort(byGrantedLevel);
    }

    for (const itemList of [origins, influences, bonds, hangUps, spells, powers, weapons, armors, shields, gears, alterations, magicBaubles]) {
      itemList.sort(byGrantedLevel);
    }

    // Assign and return
    context.alterations = alterations;
    context.altModes = altModes;
    context.armors = armors;
    context.bonds = bonds;
    context.faction = faction;
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
    context.rolePointsList = rolePointsList;
    context.roles = roles;
    // Backward-compatible alias for the templates that only ever expect one Role (the base
    // Role - an additive Role like Old Hand never replaces it)
    context.role = roles.find(r => !r.system.isAdditive);
    context.shields = shields;
    context.shieldEquipped = shieldEquipped;
    context.spells = spells;
    context.specializations = specializations;
    context.traits = traits;
    context.upgrades = upgrades;
    context.weapons = weapons;

    // Compute display levels for Role items - the base Role shows the Actor's real level,
    // unless an additive Role like Old Hand is present, in which case it shows the Effective
    // Base Role Level instead (Old Hand's own row shows its own Old Hand Level)
    const baseRole = context.role;
    const additiveRole = roles.find(r => r.system.isAdditive);
    if (baseRole) {
      baseRole.system.displayLevel = context.system.level;
      baseRole.system.isEffectiveLevel = false;
    }

    if (additiveRole && context.system.oldHandTransitionLevel) {
      const additiveLevel = context.system.level - context.system.oldHandTransitionLevel + 1;
      additiveRole.system.displayLevel = additiveLevel;

      if (baseRole) {
        baseRole.system.displayLevel = (context.system.oldHandTransitionLevel - 1) + Math.floor(additiveLevel / baseRole.system.effectiveLevelDivisor);
        baseRole.system.isEffectiveLevel = true;
      }
    }

    if (context.system.defenses.evasion.armor != equippedArmorEvasion || context.system.defenses.toughness.armor != equippedArmorToughness) {

    //   this.actor.update({
    //     "system.defenses.evasion.armor": equippedArmorEvasion,
    //     "system.defenses.toughness.armor": equippedArmorToughness,
    //   }).then(this.render(false));
    }
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
    // Foundry's own ActorSheetV2#_onDropItem() resolves to a single created Item document (or
    // null), but every sheet-handler that calls dropFunc() treats the result as a list (e.g.
    // `(await dropFunc())[0]`) - matching the plural createEmbeddedDocuments() shape used
    // elsewhere for the same purpose. Normalize here, at the one place the real dropFunc is
    // built, rather than at each of that function's many call sites.
    const dropFunc = async () => {
      const result = await super._onDropItem(event, data);
      return result ? [result] : [];
    };

    return onDropItem(data, this.actor, dropFunc);
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
   *
   * @override
   */
  async _onChangeInput(event) {
    await super._onChangeInput(event);

    // Use this if we can get the manual level input working again
    // if (event.currentTarget.name == "system.level") {
    //   return await onLevelChange(this.actor, this.actor.system.level);
    // }
  }

  /**
   * Handle clicking on the leveling buttons, where the up arrow increases the
   * level by 1 and the down arrow decreases it by 1
   * @param {Integer} levelChange The change in the level
   */
  async _onLevelChangeHelper(levelChange) {
    const newLevel = this.actor.system.level + levelChange;
    if (newLevel > 0 && newLevel <= 20) {
      await this.actor.update({
        "system.level": this.actor.system.level + levelChange,
      }).then(this.render(false));

      return await onLevelChange(this.actor, this.actor.system.level);
    }
  }

  // Add Inventory Item
  static #onItemCreate(event) {
    onItemCreate(event, this.document);
  }

  static #onItemDelete(event) {
    onItemDelete(event, this);
  }

  static #onItemEdit(event) {
    onItemEdit(event);
  }

  static #onRoll(event) {
    if (this.document.isOwner) {
      onRoll(event, this.document);
    }
  }

  static #toggleAccordion(event) {
    onToggleAccordion(event, this);
  }

  static #toggleAccordionHeader(event) {
    onToggleHeaderAccordion(event, this.document);
  }

  static #createActiveEffect(event) {
    onCreateActiveEffect(event, this.document);
  }

  static #deleteActiveEffect(event){
    onDeleteActiveEffect(event, this.document);
  }

  static #editActiveEffect(event) {
    onEditActiveEffect(event, this.document);
  }

  static #toggleActiveEffect(event){
    onToggleActiveEffect(event);
  }

  static #onSystemActorsDelete(event) {
    onSystemActorsDelete(event, this);
  }

  static #onMorph() {
    onMorph(this.document);
  }

  static #onTransform() {
    onTransform(this.document);
  }

  static #onInlineEdit(event) {
    onInlineEdit(event, this.document);
  }

  static #onEditMorphToughnessBonus(event) {
    onEditMorphToughnessBonus(event, this);
  }

  static #onEditDefenses() {
    new StatEditor(this.actor, "defense").render(true);
  }

  static #onEditSpeeds() {
    new StatEditor(this.actor, "speed").render(true);
  }

  static #onRest() {
    onRest(this);
  }

  static #onRecharge() {
    onRecharge(this);
  }

  static #onManageSelectTrait(event) {
    onManageSelectTrait(event, this.document);
  }

  static #onShieldActivationToggle(event) {
    onShieldActivationToggle(event, this);
  }

  static #onShieldEquipToggle(event) {
    onShieldEquipToggle(event, this);
  }

  static #onLevelUp() {
    this._onLevelChangeHelper(1);
  }

  static #onlevelDown() {
    this._onLevelChangeHelper(-1);
  }

  static #onToggleLock() {
    this.actor.update({
      "system.isLocked": !this.actor.system.isLocked,
    });
  }

  static #onSheetOptions(event) {
    new SheetOptions(this.actor, event).render(true);
  }

}
