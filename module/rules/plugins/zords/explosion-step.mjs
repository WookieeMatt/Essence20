// Round 15 (systems - docs/rules-batches/slSystems15.md): ExplosionStep.
// Import-light: mechanics/vehicles/vehicle-defeat.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `ExplosionStep {steps}` - on a vehicle's own item (a Vehicle Upgrade): when it is Defeated and explodes, the
 * explosion's damage is that many die steps bigger (mechanics/vehicles/vehicle-defeat.mjs - 2d2 to 2d12). Several: the
 * biggest (copies don't add up). Anti-Matter Reactor: 1. `when` sees the vehicle.
 */
registerRuleType('ExplosionStep', {
  params: { steps: { kind: 'number', required: true } },
  scopes: ['self'],
});

/**
 * How many die steps the vehicle's explosion grows by (0 when no rule says so).
 * @param {Actor} vehicle
 * @returns {Number}
 */
export function ruleExplosionSteps(vehicle) {
  if (!vehicle) {
    return 0;
  }

  return rulesOfType(vehicle, 'ExplosionStep')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: vehicle, holder: vehicle, ruleItem: item })) === true)
    .reduce((most, { rule }) => Math.max(most, Math.round(Number(rule.steps) || 0)), 0);
}
