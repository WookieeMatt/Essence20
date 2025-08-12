import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";
import { createEntry } from "../sheet-handlers/attachment-handler.mjs";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class Essence20Item extends Item {
  constructor(item, options) {
    super(item, options);
    this._dice = new Dice(ChatMessage, new RollDialog(), game.i18n);
  }

  /**
   * Sets the basic values of an item after creation but before opening its sheet.
   * @param {Object} data The information about the item.
   * @param {Object} options The options from the sheet
   * @param {String} userId The user creating the item
   */
  async _preCreate(data, options, userId) {
    await super._preCreate(data, options, userId);
    if (data.img === undefined) {
      const image = CONFIG.E20.defaultIcon[this.type];
      if (image) this.updateSource({ img: image });
    }
  }

  /** @override */
  _onUpdate(change, options, userId) {
    super._onUpdate(change, options, userId);

    // Update the entry on the parent if this is a child Item
    if (['weaponEffect', 'upgrade'].includes(this.type)) {
      const parentId = this.flags.essence20.parentId;
      const key = this.flags.essence20.collectionId;

      if (parentId && key) {
        const parentItem = this.actor.items.get(parentId);
        const entry = createEntry(this, parentItem);
        const pathPrefix = "system.items";

        parentItem.update({
          [`${pathPrefix}.${key}`]: entry,
        });
      }
    }
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
  * Extends the preparedDerivedData model to add system specific data.
  */
  prepareDerivedData() {
    super.prepareDerivedData();
    this._prepareTraits();

    if (this.type == 'armor') {
      this._prepareArmorBonuses();
    } else if (this.type == 'rolePoints') {
      this._prepareRolePoints();
    }
  }

  /**
  * Prepares the item and any upgrade traits currently on the item
  */
  _prepareTraits() {
    let itemAndUpgradeTraits = this.system.traits;
    let upgradeTraits = [];

    if (this.type == 'weapon' || this.type == 'armor') {
      for (const [, item] of Object.entries(this.system.items)) {
        if (item.type == 'upgrade') {
          upgradeTraits.push(item.traits);

          for (const traits of upgradeTraits) {
            if (traits) {
              for (const trait of traits) {
                if (!itemAndUpgradeTraits.includes(trait)) {
                  itemAndUpgradeTraits.push(trait);
                }
              }
            }
          }
        }
      }

      if (itemAndUpgradeTraits) {
        this.system.itemAndUpgradeTraits = itemAndUpgradeTraits;
      }
    }
  }

  /**
  * Prepares the combined armor bonuses from the armor and any upgrades
  */
  _prepareArmorBonuses() {
    let armorBonusToughness = this.system.bonusToughness;
    let armorBonusEvasion  = this.system.bonusEvasion;

    for (const [, item] of Object.entries(this.system.items)) {
      if (item.type == 'upgrade' && item.subtype == 'armor'){
        if (item.armorBonus.defense == 'toughness') {
          armorBonusToughness += item.armorBonus.value;
        } else if (item.armorBonus.defense == 'evasion') {
          armorBonusEvasion += item.armorBonus.value;
        }
      }
    }

    this.system.totalBonusEvasion = armorBonusEvasion;
    this.system.totalBonusToughness = armorBonusToughness;
  }


  /**
   * Finds the number of Role Points the actor currently has.
   */
  _prepareRolePoints() {
    if (!this.actor) return null;

    const actorLevel = this.actor.system.level;
    const resourceLevelIncreases = this._getLevelIncreases(this.system.resource.increaseLevels, actorLevel);

    if (this.system.resource.startingMax != null) {
      if (actorLevel == 20 && this.system.resource.level20Value) {
        this.system.resource.max = this.system.resource.level20Value;
      } else {
        this.system.resource.max = this.system.resource.startingMax + (this.system.resource.increase * resourceLevelIncreases);
      }
    }

    if (this.system.bonus.startingValue != null) {
      if (this.system.bonus.type != CONFIG.E20.bonusTypes.none) {
        const bonusLevelIncreases = this._getLevelIncreases(this.system.bonus.increaseLevels, actorLevel);

        if (actorLevel == 20 && this.system.bonus.level20Value) {
          this.system.bonus.value = this.system.bonus.level20Value;
        } else {
          this.system.bonus.value = this.system.bonus.startingValue + (this.system.bonus.increase * bonusLevelIncreases);
        }
      }
    }
  }

  /**
   * Determines the number of increases that have occured based on the level of the actor
   * @param {String[]} levels The array of levels that you advance at
   * @param {Number} currentLevel The current level of the actor
   * @returns {Number} The number of increases for the level of the actor
   */
  _getLevelIncreases(levels, currentLevel) {
    let levelIncreases = 0;
    for (const arrayLevel of levels) {

      const level = arrayLevel.replace(/[^0-9]/g, '');
      if (level <= currentLevel) {
        levelIncreases += 1;
      }
    }

    return levelIncreases;
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
  getRollData() {
    // If present, return the actor's roll data.
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event.currentTarget.element.dataset} dataset   The dataset of the click event.
   * @param {Actor} childRoller Optional attached Actor making the roll
   */
  async roll(dataset, childRoller=null) {
    if (dataset.rollType == 'info') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      const template = `systems/essence20/templates/actor/parts/items/${this.type}/details.hbs`;
      let templateData = {};

      if (this.type == 'origin') {
        templateData = {
          config: CONFIG.E20,
          item: {
            ...this,
            skillsString: this.system.skills.map(skill => {
              return CONFIG.E20.originSkills[skill];
            }).join(", "),
            essenceString: this.system.essences.map(essence => {
              return CONFIG.E20.originEssences[essence];
            }).join(", "),
          },
        };
      } else {
        templateData = {
          config: CONFIG.E20,
          item: this,
        };
      }

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: await foundry.applications.handlebars.renderTemplate(template, templateData),
      });
    } else if (this.type == 'perk') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      let content = `Source: ${this.system.source || 'None'} <br>`;
      content += `Prerequisite: ${this.system.prerequisite || 'None'} <br>`;
      content += `Description: ${this.system.description || 'None'}`;

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: content,
      });
    } else if (this.type == 'power') {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type.toUpperCase()}] ${this.name}`;
      const descriptionStr = game.i18n.localize('E20.ItemDescription');

      let content = `<b>${descriptionStr}</b> - ${this.system.description}<br>`;

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: content,
      });
    } else if (this.type == 'weaponEffect') {
      let weaponDataset = {};
      const roller = childRoller || this.actor;
      const skill = this.system.classification.skill;
      const shift = roller.system.skills[skill].shift;
      const shiftUp = roller.system.skills[skill].shiftUp;
      const shiftDown = roller.system.skills[skill].shiftDown + this.system.shiftDown;
      const isSpecialized = roller.system.skills[skill].isSpecialized;
      weaponDataset = {
        ...dataset,
        shift,
        skill,
        shiftUp,
        shiftDown,
        isSpecialized,
      };

      this._dice.handleSkillItemRoll(weaponDataset, this.actor, this);

      // Decrement class feature, if applicable
      const classFeature = this.actor.items.get(this.system.classFeatureId);
      if (classFeature) {
        classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - 1) });
      }
    } else if (this.type == 'spell') {
      const essence = 'any';
      const skill = 'spellcasting';
      const shift = this.actor.system.skills.spellcasting.shift;
      const shiftDown = this.system.cost;
      const spellDataset = {
        ...dataset,
        essence,
        shift,
        skill,
        shiftDown,
      };

      this._dice.handleSkillItemRoll(spellDataset, this.actor, this);
    } else if (this.type == 'magicBauble') {
      const essence = 'any';
      const skill = 'spellcasting';
      const shift = this.system.spellcastingShift;
      const spellDataset = {
        ...dataset,
        essence,
        shift,
        skill,
      };

      this._dice.handleSkillItemRoll(spellDataset, this.actor, this);
    } else {
      // Initialize chat data.
      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get('core', 'rollMode');
      const label = `[${this.type}] ${this.name}`;

      // If there's no roll data, send a chat message.
      if (!this.system.formula) {
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: this.system.description ?? '',
        });
      } else { // Otherwise, create a roll and send a chat message from it.
        // Retrieve roll data.
        const rollData = this.getRollData();

        // Invoke the roll and submit it to chat.
        const roll = new Roll(rollData.item.formula, rollData);
        // If you need to store the value first, uncomment the next line.
        // let result = await roll.roll({async: true});
        roll.toMessage({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
        });

        return roll;
      }
    }
  }
}
