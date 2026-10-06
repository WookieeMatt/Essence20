import PowerCostSelector from "../apps/power-cost-selector.mjs";
import { parseId } from "../util/utils.mjs";
import { onPowerUse } from "../mechanics/characters/power-use.mjs";
import { spendDailyUse } from "../mechanics/resources/nanomite-uses.mjs";

// Zeo Crystal Wielder (Through the Shattered Grid, Zeo Rangers Team Perk, p.27): "It costs you 1
// less Personal Power to activate the Zeo Crystal Boost Grid Power."
const ZEO_CRYSTAL_BOOST_ID = "Compendium.essence20.across_the_stars.Item.NiEaLWcx8N48fvvN";
const ZEO_CRYSTAL_WIELDER_ID = "Compendium.essence20.through_the_shattered_grid.Item.lNCrjjiiUhI6ROal";
const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

/** A fixed-cost Power's Personal Power cost for this actor, after discounts. */
export function fixedPowerCost(actor, power) {
  const cost = parseInt(power.system.powerCost) || 0;
  if (sourceOf(power) == ZEO_CRYSTAL_BOOST_ID && actor?.items?.some(item => sourceOf(item) == ZEO_CRYSTAL_WIELDER_ID)) {
    return Math.max(0, cost - 1);
  }

  return cost;
}

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
 * mechanics/characters/power-use.mjs#onPowerUse. That dispatch is the Power-side equivalent of Perks' own
 * onPerkUse - see that file's own doc comment for why nothing analogous existed here before.
 * @param {Actor} actor The Actor activating the Power
 * @param {Power} power The Power being activated
 * @param {Actor} [payer] Who spends the Power points. Defaults to `actor`; differs for a Power on a
 *   Zord or vehicle - which has no Power pool of its own - rolled by a chosen crew member, who pays.
 */
export async function powerCost(actor, power, payer = actor) {
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

  // G.I. Joe nanomite powers cost no Power points - they're limited to uses per day instead. See
  // mechanics/resources/nanomite-uses.mjs.
  if (power.system.type == "nanomite") {
    if (await spendDailyUse(actor, power)) {
      await onPowerUse(actor, power, 0);
    }

    return;
  }

  // Only characters carry a Power pool. A costed Power used with no one able to pay would otherwise
  // throw reading the pool - say so instead.
  const pool = payer?.system?.powers?.[powerType];
  const needsPool = powerType != "threat" && (power.system.hasVariableCost || power.system.powerCost);
  if (needsPool && !pool) {
    ui.notifications.warn(game.i18n.format('E20.PowerNoPool', { name: payer?.name ?? actor.name }));
    return;
  }

  if (power.system.hasVariableCost && powerType != "threat") {
    if (power.system.maxPowerCost) {
      maxPower = power.system.maxPowerCost;
    } else {
      maxPower = pool.value;
    }

    const title = "E20.PowerCost";
    new PowerCostSelector(actor, power, maxPower, powerType, title, payer).render(true);
    // The variable-cost spend (and the onPowerUse dispatch that follows it) both happen later,
    // once the player actually confirms an amount - see _powerCountUpdate below.
  } else if (powerType != "threat" && pool && pool.value >= fixedPowerCost(actor, power)) {
    const cost = fixedPowerCost(actor, power);
    const updateString = `system.powers.${powerType}.value`;
    await payer.update({ [updateString]: Math.max(0, pool.value - cost) });
    await onPowerUse(actor, power, cost);
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
 * @param {Actor} [payer] Who spends the points - see powerCost's own `payer`.
 */
export async function _powerCountUpdate(actor, powerMax, powerType, powerCost, power, payer = actor) {
  const updateString = `system.powers.${powerType}.value`;

  if ((powerCost > powerMax)
    || (powerType !="threat" && powerCost > payer.system.powers[powerType].value)) {
    ui.notifications.error(game.i18n.localize('E20.PowerOverSpent'));
  } else if (powerType != "threat") {
    await payer.update({ [updateString]: Math.max(0, payer.system.powers[powerType].value - powerCost) });
    await onPowerUse(actor, power, powerCost);
  }
}
