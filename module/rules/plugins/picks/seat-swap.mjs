// Rules-engine plug-ins, round 18 (convC - docs/rules-batches/slConvC18.md): pick source seatmates, step swapSeats.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: the GM relay is imported inside the step.
import { crewedBy } from "../../links.mjs";
import { registerPickSource, registerStep } from "../../steps.mjs";

/** Seated roles another rider can be swapped with. */
const SWAPPABLE = ['driver', 'passenger'];

/**
 * The vehicle (or Zord) the actor rides in and its own seat key there, or null.
 * @param {Actor} actor
 * @returns {?{vehicle: Actor, key: String, entry: Object}}
 */
export function seatOf(actor) {
  const crewed = crewedBy(actor);
  const entry = Object.entries(crewed?.vehicle?.system?.actors ?? {}).find(([, crew]) => crew?.uuid == actor?.uuid);
  return entry ? { vehicle: crewed.vehicle, key: entry[0], entry: entry[1] } : null;
}

/**
 * pick from: seatmates - everyone else seated as a driver or passenger in the vehicle the actor rides in, by seat key,
 * labelled "<name> (<role>)". Not aboard, or alone: nothing to pick (the pick stops the run). Nu, Pogodi!'s seat swap.
 */
export function seatmateOptions(step, ctx) {
  const seat = seatOf(ctx.actor);
  if (!seat) {
    return [];
  }

  return Object.entries(seat.vehicle.system.actors ?? {})
    .filter(([key, crew]) => key != seat.key && crew?.uuid && SWAPPABLE.includes(crew.vehicleRole))
    .map(([key, crew]) => ({ value: key, label: `${crew.name ?? key} (${crew.vehicleRole})` }));
}

registerPickSource('seatmates', seatmateOptions);

/**
 * swapSeats {seat?: <pick key>} - the actor and the rider in that seat of the same vehicle trade vehicle roles (driver /
 * passenger...). The seat is the pick stored under `seat` on the rule's item (a `pick from: seatmates`), else the run's
 * last pick (@var.picked). Written through the GM relay when this user can't write to the vehicle. `{var.other}`: the
 * other rider's name. Not aboard, or no such seat: stops the run.
 */
registerStep('swapSeats', async (step, ctx) => {
  const seat = seatOf(ctx.actor);
  const otherKey = step.seat ? ctx.item?.flags?.essence20?.rules?.choices?.[step.seat] : ctx.vars?.picked;
  const other = otherKey && otherKey != seat?.key ? seat?.vehicle?.system?.actors?.[otherKey] : null;
  if (!seat || !other) {
    return false;
  }

  const update = {
    [`system.actors.${seat.key}.vehicleRole`]: other.vehicleRole,
    [`system.actors.${otherKey}.vehicleRole`]: seat.entry.vehicleRole,
  };
  const { updateRelayed } = await import("../../../items/shared/relayed-writes.mjs");
  await updateRelayed(seat.vehicle, update);
  ctx.vars.other = other.name ?? '';
}, {
  errors: step => (step.seat !== undefined && typeof step.seat != 'string' ? ['seat must be a pick key'] : []),
});
