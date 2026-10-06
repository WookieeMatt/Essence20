import { registerRollSources, registerSpecializes } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import {
  deps, ignoreRoughTerrainWhen, isAttackItem, S1, terrainOf,
} from "../shared/terrain-perk-ids-and-readers.mjs";
import { findSourced, has } from "../shared/item-lookups.mjs";

/**
 * Adapted Vehicles (GI Joe CRB, Ranger Environmental Exposure, p.91): "Vehicles you drive in your
 * environments of expertise gain the benefits of Environment Expertise." The vehicle's driver (its
 * crew entry with the driver role) must hold this Perk and Environmental Expertise, and the terrain
 * under the VEHICLE's token must be one of the driver's environments of expertise (or, on an
 * untagged scene, the driver's own Environmental Expertise toggle is on). The vehicle then gets
 * Environmental Expertise's "Edge on non-combat Skill Tests", Specialized attacks and ignores Rough Terrain.
 */
export function adaptedVehicleDriver(vehicle) {
  if (vehicle?.type != 'vehicle') {
    return null;
  }

  for (const entry of Object.values(vehicle.system?.actors ?? {})) {
    if (entry?.vehicleRole != 'driver' || !entry.uuid) {
      continue;
    }

    const driver = (typeof fromUuidSync == 'function' ? fromUuidSync(entry.uuid) : null)
      ?? worldActors().find(a => a.uuid == entry.uuid);
    if (driver && has(driver, S1.adaptedVehicle) && has(driver, S1.environmentalExpertise)) {
      return driver;
    }
  }

  return null;
}

export function isAdaptedVehicleActive(vehicle) {
  const driver = adaptedVehicleDriver(vehicle);
  if (!driver) {
    return false;
  }

  const terrain = terrainOf(vehicle);
  const inside = terrain ? deps.isInEnvironmentOfExpertise(driver, terrain) : null;
  return inside === true || (inside !== false && !!deps.isEnvironmentalExpertiseActive(driver));
}

/** The vehicle gets Environmental Expertise's "Edge on non-combat Skill Tests". */
export function adaptedVehicleRollSources(actor, target, ctx = {}) {
  const { item } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);
  const sources = [];
  if (!actor) {
    return { sources, consumes: [] };
  }

  if (!isAttack && actor.type == 'vehicle' && isAdaptedVehicleActive(actor)) {
    sources.push({ id: 's1-adaptedVehicle', label: findSourced(adaptedVehicleDriver(actor), S1.adaptedVehicle)?.name ?? 'Adapted Vehicles', edge: true });
  }

  return { sources: sources.map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s })), consumes: [] };
}

export function adaptedVehicleSpecializes(actor, skill, item) {
  return isAttackItem(item) && actor?.type == 'vehicle' && isAdaptedVehicleActive(actor);
}

/** ROUGH_TERRAIN_IGNORERS entry. */
export function adaptedVehicleIgnoresRoughTerrain(actor) {
  return actor?.type == 'vehicle' && isAdaptedVehicleActive(actor);
}

registerRollSources(adaptedVehicleRollSources);
registerSpecializes(adaptedVehicleSpecializes);
ignoreRoughTerrainWhen(adaptedVehicleIgnoresRoughTerrain);
