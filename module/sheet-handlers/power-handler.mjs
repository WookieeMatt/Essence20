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

      if (actorItem.type == 'power' && actorItem.system.originalId == powerUuid) {
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
    });
  }

  /**
  * Handles determining the cost of a power activation
  * @param {Power} power The power
  */
  async powerCost(power) {
    let maxPower = 0;
    let powerType = "";
    if (power.system.type == "grid") {
      powerType = "personal";
    } else if (power.system.type == "sorcerous") {
      powerType = "sorcerous";
    } else {
      powerType = "threat";
    }

    // for (const actorEffect of this._actor.effects) {
    //   const parts = actorEffect.origin.split(".");
    //   if (parts[3] == power._id) {
    //     actorEffect.update({disabled: false});
    //   }
    // }

    if (power.system.hasVariableCost && powerType != "threat") {
      if (power.system.maxPowerCost) {
        maxPower = power.system.maxPowerCost;
      } else {
        maxPower = this._actor.system.power[powerType].value;
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
              callback: html => this.powerCountUpdate(rememberValues(html), power, powerType),
            },
          },
        },
      ).render(true);
    } else if (powerType != "threat" && this._actor.system.power[powerType].value >= power.system.powerCost){
      const updateString = `system.power.${powerType}.value`;
      this._actor.update({ [updateString]: Math.max(0, this._actor.system.power[powerType].value - power.system.powerCost) });
    } else if (!power.system.powerCost) {
      console.log("still working on something for here");
    } else {
      ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
    }
  }

  /**
  * Handle the spending of power for a power activated
  * @param {Options} options The options selected in power dialog.
  * @param {Power} power The power
  * @param {ClassFeature} classFeature  The classFeature that is tied to the power
  */
  powerCountUpdate (options, power, powerType) {
    const powerCost = options[power.name].value;
    const powerMax = options[power.name].max;
    const updateString = `system.power.${powerType}.value`;
    if ((powerCost > powerMax)
      || (powerType !="threat" && powerCost > this._actor.system.power[powerType].value)) {
      ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
    } else if (powerType != "threat") {
      this._actor.update({ [updateString]: Math.max(0, this._actor.system.power[powerType].value - powerCost) });
    }
  }
}
