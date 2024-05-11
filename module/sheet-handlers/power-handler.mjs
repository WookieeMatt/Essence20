import { rememberValues} from "../helpers/dialog.mjs";
import { parseId } from "../helpers/utils.mjs";

/**
 * Handles dropping a Power on to an Actor
 * @param {Actor} actor The Actor receiving the Power
 * @param {Power} power The Power being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 */
export async function powerUpdate(actor, power, dropFunc) {
  const powerUuid = parseId(power.uuid);
  let timesTaken = 0;

  for (let actorItem of actor.items) {
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
 * Handles determining the cost of a Power activation
 * @param {Actor} actor The Actor activating the Power
 * @param {Power} power The Power being activated
 */
export async function powerCost(actor, power) {
  let maxPower = 0;
  let powerType = "";

  if (power.system.type == "grid") {
    powerType = "personal";
  } else if (power.system.type == "sorcerous") {
    powerType = "sorcerous";
  } else {
    powerType = "threat";
  }

  if (power.system.hasVariableCost && powerType != "threat") {
    if (power.system.maxPowerCost) {
      maxPower = power.system.maxPowerCost;
    } else {
      maxPower = actor.system.powers[powerType].value;
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
            callback: html => _powerCountUpdate(actor, rememberValues(html), power, powerType),
          },
        },
      },
    ).render(true);
  } else if (powerType != "threat" && actor.system.powers[powerType].value >= power.system.powerCost) {
    const updateString = `system.powers.${powerType}.value`;
    actor.update({ [updateString]: Math.max(0, actor.system.powers[powerType].value - power.system.powerCost) });
  } else if (!power.system.powerCost) {
    console.log("still working on something for here");
  } else {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  }
}

/**
 * Handles the spending of a Power activation
 * @param {Actor} actor The Actor activating the Power
 * @param {Options} options The options selected in Power dialog.
 * @param {Power} power The Power being activated
 * @param {String} powerType  The type of Power
 */
function _powerCountUpdate(actor, options, power, powerType) {
  const powerCost = options[power.name].value;
  const powerMax = options[power.name].max;
  const updateString = `system.powers.${powerType}.value`;

  if ((powerCost > powerMax)
    || (powerType !="threat" && powerCost > actor.system.powers[powerType].value)) {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  } else if (powerType != "threat") {
    actor.update({ [updateString]: Math.max(0, actor.system.powers[powerType].value - powerCost) });
  }
}
