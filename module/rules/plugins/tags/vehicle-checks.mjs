import { CHECK_NAMES, registerCheck } from "../../predicate.mjs";

/**
 * Round 15 (systems - docs/rules-batches/slSystems15.md): `check:vehicleInRoughTerrain` - the token of the vehicle the
 * actor is crewing (or, for a vehicle rolling itself, its own) stands in Rough Terrain (mechanics/world/environment.mjs
 * #isInRoughTerrain - the same reading dice.mjs gave the vehicles' crew roll sources). Hydraulic Bounce's "Edge on Driving
 * Skill Tests in Rough Terrain". The helpers are loaded at `setup`; until then (and in tests that don't fill
 * `vehicleChecks`) it answers false.
 */
export const vehicleChecks = {
  isInRoughTerrain: null,
  getCrewedVehicle: null,
};

export async function loadVehicleChecks() {
  const [environment, upgrades] = await Promise.all([
    import("../../../mechanics/world/environment.mjs"),
    import("../../../mechanics/vehicles/vehicle-upgrades.mjs"),
  ]);
  vehicleChecks.isInRoughTerrain = environment.isInRoughTerrain;
  vehicleChecks.getCrewedVehicle = upgrades.getCrewedVehicle;
}

if (!CHECK_NAMES.includes('vehicleInRoughTerrain')) {
  CHECK_NAMES.push('vehicleInRoughTerrain');
}

registerCheck('vehicleInRoughTerrain', actor => {
  const vehicle = vehicleChecks.getCrewedVehicle?.(actor)?.vehicle ?? (actor?.type == 'vehicle' ? actor : null);
  const token = vehicle?.getActiveTokens?.()?.[0];
  return !!token && !!vehicleChecks.isInRoughTerrain?.(token.document);
});

globalThis.Hooks?.once?.('setup', () => {
  loadVehicleChecks().catch(error => console.error('Essence20 | round 15 vehicle checks failed to load', error));
});
