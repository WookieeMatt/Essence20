import { Dice } from "../dice.mjs";
import { RollDialog } from "../helpers/roll-dialog.mjs";

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

    if (armorBonusEvasion) {
      this.system.totalBonusEvasion = armorBonusEvasion;
    }

    if (armorBonusToughness) {
      this.system.totalBonusToughness = armorBonusToughness;
    }
  }


  _prepareRolePoints() {
    if (!this.actor) return null;
    let levelIncreases = 0;
    for (const arrayLevel of this.system.levels) {

      const level = arrayLevel.replace(/[^0-9]/g, '');
      if (level <= this.actor.system.level) {
        levelIncreases += 1;
      }
    }

    if (this.system.level20Value != 0) {
      this.system.rolePoints.max = this.system.level20Value;
    } else {
      this.system.rolePoints.max = this.system.starting + (this.system.increase * levelIncreases);
    }

    if (this.system.isSeparate) {
      levelIncreases = 0;
      for (const arrayLevel of this.system.bonus.levels) {
        const level = arrayLevel.replace(/[^0-9]/g, '');
        if (level <= this.actor.system.level) {
          levelIncreases += 1;
        }
      }

      if (this.system.bonus.level20Value != 0) {
        this.system.rolePoints.secondary.max = this.system.bonus.level20Value;
      } else {
        this.system.rolePoints.secondary.max = this.system.bonus.starting + (this.system.bonus.increase * levelIncreases);
      }
    }
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
   * @param {String} childKey The key of the item attached to another item
   * @private
   */
  async roll(dataset, childKey) {
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
        content: await renderTemplate(template, templateData),
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
    } else if (this.type == 'weapon') {
      const skill = this.system.items[childKey].classification.skill;
      const shift = this.actor.system.skills[skill].shift;
      const shiftUp = this.actor.system.skills[skill].shiftUp;
      const shiftDown = this.actor.system.skills[skill].shiftDown + this.system.items[childKey].shiftDown;
      const isSpecialized = this.actor.system.skills[skill].isSpecialized;
      const weaponDataset = {
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
