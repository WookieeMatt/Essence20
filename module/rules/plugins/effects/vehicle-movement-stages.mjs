// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): the vehicle upgrades' Movement stages.
// Registered on import; see module/rules/plugins/index.mjs.
import { RULE_TYPES } from "../../types.mjs";

/**
 * Movement `stage: "vehicleBase"` and `stage: "vehicle"` - applied by mechanics/vehicles/vehicle-upgrades.mjs#applyToVehicle
 * (documents/actor.mjs#_prepareVehicleData, after the driver-count halving and before Superstructure), in that order, on a
 * vehicle's own upgrades' Movement rules (./derived-hook-movement.mjs#applyMovementStage). Within a stage the usual op
 * order holds (set, multiply, add, max, min), the result never below 0.
 *
 *   vehicleBase   what one Movement type takes from another: Shallow Draft (ground at least its Aquatic Movement),
 *                 Submarine Mode (an Aquatic Movement of its ground speed, else half its aerial).
 *   vehicle       the changes on top: the Anti-Matter Reactor's x3, then the Biotech Performance Enhancer's +20 / +10,
 *                 Optimized Seating's and Camo Netting's -10.
 *
 * Neither runs for a crashed vehicle or one whose engine was stopped (applyToVehicle isn't reached then).
 */
export const VEHICLE_STAGES = ['vehicleBase', 'vehicle'];

const stage = RULE_TYPES.Movement?.params?.stage;
for (const name of VEHICLE_STAGES) {
  if (stage?.options && !stage.options.includes(name)) {
    stage.options.push(name);
  }
}
