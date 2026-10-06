/**
 * Motor Pool Connections (Quartermaster's Guide to Gear, General Perk, p.30): "Whenever you are
 * assigned a vehicle, you gain a bonus requisition budget of 3 vehicle upgrades."
 *
 * Vehicle upgrade requisition (QGtG p.54-55): "Temporary vehicle upgrades cost the following number
 * of Requisition Attempts or Requisition Points, based on their availability: Standard: 1, Limited:
 * 2, Restricted: 5, Prototypical: 7, Theoretical: 10. Vehicle upgrades require a Driving or
 * Technology Skill Test using normal Availability DIFs."
 *
 * A Use button on the Perk: pick the vehicle (the one you crew, or a vehicle you own), pick a
 * compendium vehicle upgrade within the remaining budget, roll Driving or Technology against its
 * Availability DIF, and on a success the upgrade is installed. The budget is 3 per vehicle per
 * mission (mechanics/resources/scene-clock.mjs's mission window), spent on the attempt like a Requisition.
 */
import { registerUse } from "../../mechanics/item-hooks.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import { IDS, T, isItem, worldActors } from "../shared/resource-team-lookups.mjs";

export const MOTOR_POOL_BUDGET = 3;
export const UPGRADE_COST = { automatic: 1, standard: 1, limited: 2, restricted: 5, prototype: 7, unique: 7, theoretical: 10 };

export function upgradeCost(availability) {
  return UPGRADE_COST[availability] ?? 1;
}

const budgetKey = vehicle => `motorPoolBudget.${vehicle?.id}`;

export function budgetLeft(actor, vehicle) {
  return MOTOR_POOL_BUDGET - getUses(actor, budgetKey(vehicle), 'mission');
}

async function vehiclesFor(actor) {
  const { getCrewedVehicle } = await import("../../mechanics/vehicles/vehicle-upgrades.mjs");
  const list = [];
  const crewed = getCrewedVehicle(actor)?.vehicle;
  if (crewed) {
    list.push(crewed);
  }

  for (const vehicle of worldActors()) {
    if (vehicle.type == 'vehicle' && vehicle.isOwner && !list.includes(vehicle)) {
      list.push(vehicle);
    }
  }

  return list;
}

async function run(item, economy, pay) {
  const actor = item.parent;
  const { chooseSelect, findItems, pickOne, rollTest } = await import("../../mechanics/resources/grants.mjs");
  const vehicles = await vehiclesFor(actor);
  if (!vehicles.length) {
    ui.notifications.warn(T('ResMotorPoolNoVehicle'));
    return null;
  }

  const vehicleId = vehicles.length == 1 ? vehicles[0].id : await chooseSelect(item.name, T('ResMotorPoolPickVehicle'),
    vehicles.map(v => ({ value: v.id, label: `${v.name} (${budgetLeft(actor, v)}/${MOTOR_POOL_BUDGET})` })));
  const vehicle = vehicles.find(v => v.id == vehicleId);
  if (!vehicle) {
    return null;
  }

  const left = budgetLeft(actor, vehicle);
  if (left <= 0) {
    ui.notifications.warn(T('ResMotorPoolSpent', { name: vehicle.name }));
    return null;
  }

  const rows = await findItems({
    type: 'upgrade',
    matches: entry => entry.system?.type == 'vehicle' && upgradeCost(entry.system?.availability) <= left,
    fields: ['system.availability'],
  });
  const uuid = await pickOne(item.name, rows);
  if (!uuid) {
    return null;
  }

  const upgrade = await fromUuid(uuid);
  const availability = upgrade?.system?.availability ?? 'standard';
  const skill = await chooseSelect(item.name, T('ResMotorPoolPickSkill'), [
    { value: 'technology', label: game.i18n.localize(CONFIG.E20?.skills?.technology ?? 'Technology') },
    { value: 'driving', label: game.i18n.localize(CONFIG.E20?.skills?.driving ?? 'Driving') },
  ]);
  if (!skill || !(await pay(null))) {
    return null;
  }

  const dif = CONFIG.E20?.availabilityDifficulties?.[availability] ?? 0;
  const cost = upgradeCost(availability);
  await markUsed(actor, budgetKey(vehicle), { window: 'mission', count: cost });
  const success = dif <= 0 ? true : (await rollTest(actor, skill, dif)).success;
  if (!success) {
    return T('ResMotorPoolDenied', { name: upgrade.name, vehicle: vehicle.name, left: budgetLeft(actor, vehicle) });
  }

  const data = upgrade.toObject();
  delete data._id;
  foundry.utils.setProperty(data, 'flags.core.sourceId', uuid);
  foundry.utils.setProperty(data, 'flags.essence20.motorPool', true);
  await vehicle.createEmbeddedDocuments('Item', [data]);
  return T('ResMotorPoolGranted', { name: upgrade.name, vehicle: vehicle.name, left: budgetLeft(actor, vehicle) });
}

registerUse({
  id: 'resMotorPool',
  matches: item => isItem(item, IDS.motorPool),
  run,
});
