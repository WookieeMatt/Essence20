import PowerCostSelector from "../apps/power-cost-selector.mjs";
import { parseId } from "../helpers/utils.mjs";
import { onPowerUse } from "../helpers/power-use.mjs";

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
 * Handles determining the cost of a Power activation, then - once the cost is actually spent (or
 * confirmed there's nothing to spend) - dispatches to the Power's own bespoke mechanic via
 * helpers/power-use.mjs#onPowerUse. That dispatch is the Power-side equivalent of Perks' own
 * onPerkUse - see that file's own doc comment for why nothing analogous existed here before.
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

  // Sorcerous Powers (Finster's Monster-Matic Cookbook, "Building Sorcerous Powers," p.274):
  // powerCost is a ONE-TIME budget spent to BUILD the Power when the Sorcery Perk is taken (or a
  // new level's points are gained) - "Once you have created a Power, you can use it as often as
  // the Power dictates." It is never spent again on activation, unlike a Grid Power's Personal
  // Power cost - see documents/actor.mjs#_prepareSorcerousPower's own committed-vs-available
  // tracking of that same budget. Dispatches straight to the Power's own effect with nothing spent.
  if (powerType == "sorcerous") {
    await onPowerUse(actor, power, 0);
    return;
  }

  if (power.system.hasVariableCost && powerType != "threat") {
    if (power.system.maxPowerCost) {
      maxPower = power.system.maxPowerCost;
    } else {
      maxPower = actor.system.powers[powerType].value;
    }

    const title = "E20.PowerCost";
    new PowerCostSelector(actor, power, maxPower, powerType, title).render(true);
    // The variable-cost spend (and the onPowerUse dispatch that follows it) both happen later,
    // once the player actually confirms an amount - see _powerCountUpdate below.
  } else if (powerType != "threat" && actor.system.powers[powerType].value >= power.system.powerCost) {
    const updateString = `system.powers.${powerType}.value`;
    await actor.update({ [updateString]: Math.max(0, actor.system.powers[powerType].value - power.system.powerCost) });
    await onPowerUse(actor, power, power.system.powerCost);
  } else if (!power.system.powerCost) {
    // Free-to-activate Powers (powerCost null/0) have nothing to spend, but still need their own
    // effect to actually run - this used to be a bare placeholder with no dispatch at all.
    await onPowerUse(actor, power, 0);
  } else {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  }
}

/**
 * Handles the spending of a Power activation, then dispatches to the Power's own bespoke mechanic
 * via onPowerUse - the variable-cost sibling of powerCost's own fixed-cost dispatch above, reached
 * once the player confirms an amount in apps/power-cost-selector.mjs's own form.
 * @param {Actor} actor The Actor activating the Power
 * @param {Integer} powerMax The maximum power points that can be spent on the power
 * @param {String} powerType  The type of Power
 * @param {Integer} powerCost The modified power cost
 * @param {Power} [power] The Power being activated - optional only so this function's own existing
 *   unit tests (which exercise the cost-math in isolation) don't need to supply a real Item; a real
 *   call site always has one.
 */
export async function _powerCountUpdate(actor, powerMax, powerType, powerCost, power) {
  const updateString = `system.powers.${powerType}.value`;

  if ((powerCost > powerMax)
    || (powerType !="threat" && powerCost > actor.system.powers[powerType].value)) {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  } else if (powerType != "threat") {
    await actor.update({ [updateString]: Math.max(0, actor.system.powers[powerType].value - powerCost) });
    await onPowerUse(actor, power, powerCost);
  }
}
