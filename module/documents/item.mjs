import { Dice } from "../dice.mjs";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class Essence20Item extends Item {
  constructor(item, options) {
    super(item, options);
    this._dice = new Dice(game.i18n, CONFIG.E20, ChatMessage);
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
   * @private
   */
  async roll(dataset) {
    if (this.type == 'perk') {
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
      const label = `[${this.type}] ${this.name}`;
      const descriptionStr = game.i18n.localize('E20.ItemDescription');
      const noneStr = game.i18n.localize('E20.None');
      const classFeatureStr = game.i18n.localize('ITEM.TypeClassfeature');
      const classFeatureId = this.system.classFeatureId;

      let content = `<b>${descriptionStr}</b> - ${this.system.description}<br>`;
      if (this.actor.type !== "vehicle"){
        content += `<b>${classFeatureStr}</b> - ${classFeatureId ? this.actor.items.get(classFeatureId).name : noneStr}`;
      }

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: content,
      });
    } else if (this.type == 'weapon') {
      const dataset = { skill: this.system.classification.skill };
      const skillRollOptions = await this._dice.getSkillRollOptions(dataset, this.actor);

      if (skillRollOptions.cancelled) {
        return;
      }

      const weapon = this.actor.items.get(this._id);
      this._dice.rollSkill(dataset, skillRollOptions, this.actor, weapon);

      const classFeature = this.actor.items.get(weapon.system.classFeatureId);
      if (classFeature) {
        classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - 1) });
      }
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
          content: this.system.description ?? ''
        });
      }
      // Otherwise, create a roll and send a chat message from it.
      else {
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
