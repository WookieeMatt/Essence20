// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerRecipient } from "../../steps.mjs";
import { crewedVehicle } from "./crewed-vehicle-recipient.mjs";

/**
 * Recipient `pilotedVehicleOrTarget` - the vehicle or Zord the actor crews (any seat, crewed-vehicle-recipient.mjs), else
 * the run's first target when it is a vehicle: the old items/vehicles/engine-override.mjs#getEngineOverrideTarget that
 * Engine Override, Jury Rig and Improvise Armor shared ("a vehicle within reach, including one you ride in or drive").
 * Use it with `focus` to make that vehicle the run's target.
 */
export function pilotedVehicleOrTarget(actor, targets) {
  const crewed = crewedVehicle(actor);
  if (crewed.length) {
    return crewed;
  }

  const target = targets?.[0];
  return target?.type == 'vehicle' ? [target] : [];
}

registerRecipient('pilotedVehicleOrTarget', (match, ctx) => pilotedVehicleOrTarget(ctx.actor, ctx.targets));
