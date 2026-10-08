// Round 14 (dice): recipient crewedVehicle - the vehicle or Zord this actor is crewing, any seat (driver or passenger;
// the first found, the same world scan dice.mjs#_getPilotedVehicle made with no role). Roadside Assistant.
import { registerRecipient } from "../../steps.mjs";
import { crewing } from "../shared/zord-crew-lookups.mjs";

/** The vehicle the actor crews in any seat, or none. */
export function crewedVehicle(actor) {
  const crewed = crewing(actor);
  return crewed?.vehicle ? [crewed.vehicle] : [];
}

registerRecipient('crewedVehicle', (match, ctx) => crewedVehicle(ctx.actor));
