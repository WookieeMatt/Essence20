// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): VehicleDefeat.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/vehicles/vehicle-defeat.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `VehicleDefeat {brawnDif}` - on a vehicle's own item (a Vehicle Upgrade): when it is brought to 0 Health, its Brawn
 * Test to avoid exploding is against this DIF instead of the usual one (mechanics/vehicles/vehicle-defeat.mjs). Several:
 * the lowest. Heavy Water Coolant: DIF 10. `when` sees the vehicle.
 */
registerRuleType('VehicleDefeat', {
  // specialize (book check 2026-10-06): a vehicle with Brawn ranks makes that test Specialized (Heavy Water Coolant).
  params: { brawnDif: { kind: 'formula', required: true }, specialize: { kind: 'bool' } },
  scopes: ['self'],
});

/**
 * The Brawn DIF the vehicle's VehicleDefeat rules set, or null when none does.
 * @param {Actor} vehicle
 * @returns {?Number}
 */
export function ruleVehicleDefeatDif(vehicle) {
  if (!vehicle) {
    return null;
  }

  const difs = rulesOfType(vehicle, 'VehicleDefeat')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: vehicle, holder: vehicle, ruleItem: item })) === true)
    .map(({ rule, item }) => Number(resolveValue(rule.brawnDif, { actor: vehicle, item }, NaN)))
    .filter(Number.isFinite);
  return difs.length ? Math.min(...difs) : null;
}

/**
 * Whether a VehicleDefeat rule makes the explosion Brawn Test Specialized (`specialize: true`, its `when` holding). The
 * caller still needs the vehicle to have Brawn ranks.
 * @param {Actor} vehicle
 * @returns {Boolean}
 */
export function ruleVehicleDefeatSpecialized(vehicle) {
  if (!vehicle) {
    return false;
  }

  return rulesOfType(vehicle, 'VehicleDefeat').some(({ rule, item }) => rule.specialize === true
    && evaluate(rule.when, contextFor({ self: vehicle, holder: vehicle, ruleItem: item })) === true);
}
