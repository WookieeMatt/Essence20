import { registerRecipient } from "../../steps.mjs";

/**
 * Round 15 (items2): recipient `crew` - every creature seated in the actor (a vehicle or Zord: its system.actors
 * entries, driver and passengers, resolved live). Not a vehicle, or nobody aboard: nobody. R.R.R. (Rapid Rescue
 * Response)'s heal for the damaged beings inside.
 */
export function crewOf(vehicle) {
  if (!['vehicle', 'zord'].includes(vehicle?.type)) {
    return [];
  }

  const lookup = uuid => {
    try {
      return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
    } catch (error) {
      return null;
    }
  };

  return [...new Set(Object.values(vehicle.system?.actors ?? {}).map(entry => lookup(entry?.uuid)).filter(Boolean))];
}

registerRecipient('crew', (match, ctx) => crewOf(ctx.actor));
