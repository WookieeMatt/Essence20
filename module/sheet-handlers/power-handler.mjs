import {
  parseId,
} from "../helpers/utils.mjs";

export class PowerHandler {
  /**
  * Constructor
  * @param {Essence20ActorSheet} actorSheet The actor sheet
  */
  constructor(actorSheet) {
    this._actorSheet = actorSheet;
    this._actor = actorSheet.actor;
  }

  /**
  * Handle the dropping of a power on to a character
  * @param {Power} power The power
  * @param {Function} dropFunc   The function to call to complete the Power drop
  */

  async powerUpdate(power, dropFunc) {
    const powerUuid = parseId(power.uuid);
    let timesTaken  = 0;
    let classFeatureId = "";

    for (let actorItem of this._actor.items) {
      if (actorItem.type =='classFeature') {
        if (power.system.type == "grid") {
          if (actorItem.name == 'Personal Power') {
            classFeatureId = actorItem._id;
          }

        }
      }

      if (actorItem.type == 'power') {
        if (actorItem.system.originalId == powerUuid) {
          timesTaken++;
          if (power.system.timesSelected == timesTaken) {
            ui.notifications.warn(game.i18n.localize('E20.PowerAlreadyTaken'));
            return;
          }
        }
      }
    }

    const newPowerList = await dropFunc();
    const newPower = newPowerList[0];

    await newPower.update ({
      "system.originalId": powerUuid,
      "system.classFeatureId": classFeatureId,
    });

  }

}
