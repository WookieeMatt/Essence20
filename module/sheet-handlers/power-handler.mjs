import {
  parseId,
  rememberValues,
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
    let timesTaken = 0;
    let classFeatureId = "";

    for (let actorItem of this._actor.items) {
      if (actorItem.type =='classFeature') {
        if (power.system.type == "grid" && actorItem.name == 'Personal Power') {
          classFeatureId = actorItem._id;
        }
      } else if (actorItem.type == 'power' && actorItem.system.originalId == powerUuid) {
        timesTaken++;
        if (power.system.selectionLimit == timesTaken) {
          ui.notifications.error(game.i18n.localize('E20.PowerAlreadyTaken'));
          return;
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

  /**
  * Handles determining the cost of a power activation
  * @param {Power} power The power
  */
  async powerCost(power) {
    let maxPower = 0;
    const classFeature = this._actor.items.get(power.system.classFeatureId);

    if (power.system.hasVariableCost && classFeature) {
      if (power.system.maxPowerCost) {
        maxPower = power.system.maxPowerCost;
      } else {
        maxPower = classFeature.system.uses.value;
      }

      new Dialog(
        {
          title: game.i18n.localize('E20.PowerCost'),
          content: await renderTemplate("systems/essence20/templates/dialog/power-cost.hbs", {
            power: power,
            maxPower: maxPower,

          }),

          buttons: {
            save: {
              label: game.i18n.localize('E20.AcceptButton'),
              callback: html => this.powerCountUpdate(rememberValues(html), power, classFeature),
            },
          },
        },
      ).render(true);

    } else if (classFeature && classFeature.system.uses.value >= power.system.powerCost){
      classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - power.system.powerCost) });

    } else {
      ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
      return;
    }
  }


  /**
  * Handle the spending of power for a power activated
  *
  * @param {Power} power The power
  * @param {ClassFeature} classFeature  The classFeature that is tied to the power
  */
  powerCountUpdate (options, power, classFeature) {

    if ((options[power.name].value > options[power.name].max) || (classFeature && options[power.name].value > classFeature.system.uses.value)) {
      ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
      return;
    } else if(classFeature) {
      classFeature.update({ ["system.uses.value"]: Math.max(0, classFeature.system.uses.value - options[power.name].value) });
    }
  }
}
