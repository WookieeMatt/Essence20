import {
  createItemCopies,
  deleteAttachmentsForItem,
} from "../helpers/utils.mjs";

export class AdvancementHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }
  /**
   * Updates the actor based on a level change from the attached role
   * @param {Actor} actor The actor whose level has changed
   * @param {Number} newLevel The new level that you are changing to.
   */
  async onLevelChange(actor, newLevel) {
    const previousLevel = actor.getFlag('essence20', 'previousLevel');

    if (previousLevel && newLevel > previousLevel) {
      for (const item of actor.items) {
        if (item.type == "role") {
          for (const essence in item.system.essenceLevels) {
            let totalIncrease = 0;
            for (let i =0; i<item.system.essenceLevels[essence].length; i++) {
              const essenceLevel = item.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
              if (essenceLevel <= newLevel && essenceLevel > previousLevel) {
                totalIncrease += 1;
              }
            }

            const essenceValue = actor.system.essences[essence] + totalIncrease;
            const essenceString = `system.essences.${essence}`;

            actor.update({
              [essenceString]: essenceValue,
            });

          }

          if (item.system.powers.personal.starting) {
            let totalIncrease = 0;
            for (let i =0; i<item.system.powers.personal.levels.length; i++) {
              const powerIncreaseLevel = item.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
              if (powerIncreaseLevel <= newLevel && powerIncreaseLevel > previousLevel) {
                totalIncrease += 1;
              }
            }

            const newPersonalPowerMax = parseInt(actor.system.powers.personal.max) + parseInt(item.system.powers.personal.increase * totalIncrease);

            actor.update({
              "system.powers.personal.max": newPersonalPowerMax,
            });
          }

          await createItemCopies(item.system.items, actor, "perk", item, previousLevel);
        }
      }
    } else if (newLevel < previousLevel) {
      for (const item of actor.items) {
        if (item.type == "role") {
          for (const essence in item.system.essenceLevels) {
            let totalDecrease = 0;
            for (let i =0; i<item.system.essenceLevels[essence].length; i++) {
              const essenceLevel = item.system.essenceLevels[essence][i].replace(/[^0-9]/g, '');
              if (essenceLevel > newLevel && essenceLevel <= previousLevel) {
                totalDecrease += 1;
              }
            }

            let essenceValue = actor.system.essences[essence] - totalDecrease;
            const essenceString = `system.essences.${essence}`;
            if (essenceValue < 0) {
              essenceValue = 0;
            }

            actor.update({
              [essenceString]: essenceValue,
            });

          }

          if (item.system.powers.personal.starting) {
            let totalDecrease = 0;
            for (let i =0; i<item.system.powers.personal.levels.length; i++) {
              const powerIncreaseLevel = item.system.powers.personal.levels[i].replace(/[^0-9]/g, '');
              if (powerIncreaseLevel > newLevel && powerIncreaseLevel <= previousLevel) {
                totalDecrease += 1;
              }
            }

            let newPersonalPowerMax = parseInt(actor.system.powers.personal.max) - parseInt(item.system.powers.personal.increase * totalDecrease);
            if (newPersonalPowerMax < 0) {
              newPersonalPowerMax = 0;
            }

            actor.update({
              "system.powers.personal.max": newPersonalPowerMax,
            });
          }

          await deleteAttachmentsForItem(item, actor, previousLevel);
        }
      }
    }

    actor.setFlag('essence20', 'previousLevel', newLevel);
  }
}
