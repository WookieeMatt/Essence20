import PowerCostSelector from "../apps/power-cost.mjs";
import { parseId } from "../helpers/utils.mjs";

/**
 * Handles dropping a Power on to an Actor
 * @param {Actor} actor The Actor receiving the Power
 * @param {Power} power The Power being dropped
 * @param {Function} dropFunc The function to call to complete the Power drop
 */
export async function onPowerDrop(actor, power, dropFunc) {
  const powerUuid = parseId(power.uuid);
  let timesTaken = 0;

  for (let actorItem of actor.items) {
    if (actorItem.type == 'power' && actorItem.system.originalId == powerUuid) {
      timesTaken++;
      if (power.system.selectionLimit == timesTaken) {
        ui.notifications.error(game.i18n.format(
          'E20.PowerAlreadyTaken',
          {actorName: actor.name, selectionLimit: power.system.selectionLimit}),
        );
        return false;
      }
    }
  }

  const newPowerList = await dropFunc();
  const newPower = newPowerList[0];

  return await newPower.update ({
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

    const title = "E20.PowerCost";
    new PowerCostSelector(actor, power, maxPower, powerType, title).render(true);
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
 * @param {Integer} powerMax The maximum power points that can be spent on the power
 * @param {String} powerType  The type of Power
 * @param {Integer} powerCost The modified power cost
 */
export function _powerCountUpdate(actor, powerMax, powerType, powerCost) {
  const updateString = `system.powers.${powerType}.value`;

  if ((powerCost > powerMax)
    || (powerType !="threat" && powerCost > actor.system.powers[powerType].value)) {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  } else if (powerType != "threat") {
    actor.update({ [updateString]: Math.max(0, actor.system.powers[powerType].value - powerCost) });
  }
}
