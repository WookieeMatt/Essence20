import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { personalVehicleEdge, SUMMON } from "../../mechanics/companions/summons.mjs";
import { getCrewedVehicle } from "../../mechanics/vehicles/vehicle-upgrades.mjs";
import { itemsOf, sourceOfOrUndefined as sourceOf } from "../shared/item-lookups.mjs";

/**
 * Personal vehicles (Galaxy Glider, Jet Jammer, Sharkcycle Rider, Strata/Vector Cycle): "you gain Edge on
 * Driving Skill Tests when piloting it" / Galaxy Glider's Acrobatics - summons.mjs's personalVehicleEdge,
 * read on the crew member's roll and labelled with the Perk that gave the vehicle.
 */

// No uuid guard on purpose (a key without a grantor reads the unsourced items) - the reading it always had.
const findSourced = (actor, uuid) => itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;

const VEHICLE_GRANTOR = {
  sharkCycle: SUMMON.sharkcycleRider,
  galaxyGlider: SUMMON.galaxyGlider,
  jetJammer: SUMMON.jetJammer,
  strataCycle: SUMMON.vectorStrataCycle,
  vectorCycle: SUMMON.vectorStrataCycle,
};

export function personalVehicleSources(actor, target, { rolledSkill } = {}) {
  if (!actor || !rolledSkill || actor.type == 'vehicle') {
    return { sources: [] };
  }

  const vehicle = getCrewedVehicle(actor)?.vehicle;
  if (!personalVehicleEdge(actor, rolledSkill, vehicle)) {
    return { sources: [] };
  }

  const key = vehicle.flags.essence20.personalVehicle;
  const grantor = findSourced(actor, VEHICLE_GRANTOR[key]);
  return { sources: [{ id: 'fix3PersonalVehicle', label: grantor?.name ?? vehicle.name, edge: true }] };
}

registerRollSources(personalVehicleSources);
