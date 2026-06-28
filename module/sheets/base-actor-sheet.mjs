const { HandlebarsApplicationMixin }= foundry.applications.api
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;

import SheetOptions from "../apps/sheet-options.mjs";
import {
  prepareActiveEffectCategories,
  onCreateActiveEffect,
  onDeleteActiveEffect,
  onDropActiveEffect,
  onEditActiveEffect,
  onToggleActiveEffect,
} from "../helpers/effects.mjs";
import { getNumActions } from "../helpers/actor.mjs";
import { onLevelChange } from "../sheet-handlers/role-handler.mjs";
import { prepareSystemActors,
  onSystemActorsDelete,
  onVehicleRoleUpdate,
  onCrewNumberUpdate
} from "../sheet-handlers/vehicle-handler.mjs";
import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";
import { onTransform } from "../sheet-handlers/transformer-handler.mjs";
import {
  onEditMorphToughnessBonus,
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
      itemCreate: this.#onItemCreate,
      itemDelete: this.#onItemDelete,
      itemEdit: this.#onItemEdit,
      rollable: this.#onRoll,
      toggleAccordion: this.#toggleAccordion,
      toggleAccordionHeader: this.#toggleAccordionHeader,
      createEffect: this.#createActiveEffect,
      deleteEffect: this.#deleteActiveEffect,
      editEffect: this.#editActiveEffect,
      toggleEffect: this.#toggleActiveEffect,
    },
    classes: ["essence20", "sheet", "actor"],
    tag: 'form',
    position: {
      width: 620,
      height: 574,
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    window: {
      resizable: true,
    },
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

    if (['npc', 'zord', 'megaform', 'vehicle', 'companion'].includes(actorData.type)) {
      this._prepareDisplayedNpcSkills(context);
    }

    this._prepareItems(context);

        // Prepare WeaponEffect Skill List
    this._prepareWeaponEffectSkills(actorData, context);

    //Prepare Initiative Skills
    context.initiativeSkills = this._prepareInitiativeSkills(actorData);

    context.accordionStates = this.accordionStates;
    context.canMorphOrTransform = context.document.system.canMorph || context.document.system.canTransform;

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
    let role = null;
    let rolePoints = null;

    // Iterate through items, allocating to containers
    for (let i of context.document.items) {
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
    context.rolePoints = rolePoints;
    context.role = role;
    context.shields = shields;
    context.shieldEquipped = shieldEquipped;
    context.spells = spells;
    context.specializations = specializations;
    context.traits = traits;
    context.upgrades = upgrades;
    context.weapons = weapons;


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
    onItemDelete(event, this)
  }

  static #onItemEdit(event) {
    onItemEdit(event, this.document);
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
}
