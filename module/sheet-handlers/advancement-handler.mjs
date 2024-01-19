import {
  createItemCopies,
  deleteAttachmentsForItem,
  getItemsOfType,
  roleValueChange,
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
    if (!previousLevel || previousLevel == newLevel) {
      return;
    }

    for (const item of getItemsOfType("role", actor.items)) {
      for (const essence in item.system.essenceLevels) {
        const totalChange = await roleValueChange(actor.system.level, item.system.essenceLevels[essence], previousLevel);
        const essenceValue = Math.max(0, actor.system.essences[essence] + totalChange);
        const essenceString = `system.essences.${essence}`;

        actor.update({
          [essenceString]: essenceValue,
        });
      }

      if (item.system.powers.personal.starting) {
        const totalChange = await roleValueChange(actor.system.level, item.system.powers.personal.levels, previousLevel);
        const newPersonalPowerMax = Math.max(
          0,
          parseInt(actor.system.powers.personal.max) + parseInt(item.system.powers.personal.increase * totalChange),
        );

        actor.update({
          "system.powers.personal.max": newPersonalPowerMax,
        });
      }

      if (newLevel > previousLevel) {
        await createItemCopies(item.system.items, actor, "perk", item, previousLevel);
      } else {
        await deleteAttachmentsForItem(item, actor, previousLevel);
      }
    }

    actor.setFlag('essence20', 'previousLevel', newLevel);
  }
}
