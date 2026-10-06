import { getUses } from "../../../mechanics/resources/scene-clock.mjs";
import { resolveValue } from "../../formula.mjs";
import { interpolate, registerTag } from "../../predicate.mjs";
import { registerPickSource, registerStep } from "../../steps.mjs";
import { crewedVehicle } from "../zords/crewed-vehicle-recipient.mjs";
import { listOf } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - a requisition budget per vehicle (Motor Pool Connections):
 *
 *   pick source ownedVehicles      the vehicle the actor crews (any seat), then every world vehicle the user owns
 *   step windowCount {flag, window, var}
 *       @var.<var> = the actor's count under that Scene Clock flag in the window (scene / encounter / mission), as
 *       markWindow keeps it. The flag may read a pick or a value ({choice.x} / {var.x}); anything but letters, digits,
 *       _ and - becomes - (a picked uuid's dots) - windowFlag(), shared with markWindow's own filling.
 *   tag item:upgradeCostAtMost:<formula>
 *       the entry asked about (a pickEntry candidate) costs no more than that many Requisition budget points by its
 *       Availability (Quartermaster's Guide: Standard 1, Limited 2, Restricted 5, Prototypical 7, Theoretical 10).
 */

export const UPGRADE_COST = { automatic: 1, standard: 1, limited: 2, restricted: 5, prototype: 7, unique: 7, theoretical: 10 };

export const upgradeCost = availability => UPGRADE_COST[availability] ?? 1;

/** A flag name with its picks / values filled and made safe for a flag key. */
export function windowFlag(text, ctx) {
  const filled = (interpolate(String(text ?? ''), ctx.item) ?? String(text ?? ''))
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''));
  return filled.replace(/[^\w-]/g, '-');
}

registerPickSource('ownedVehicles', (step, ctx) => {
  const list = [...crewedVehicle(ctx.actor)];
  for (const vehicle of listOf(globalThis.game?.actors)) {
    if (vehicle?.type == 'vehicle' && vehicle.isOwner && !list.includes(vehicle)) {
      list.push(vehicle);
    }
  }

  return list.map(vehicle => ({ value: vehicle.uuid, label: vehicle.name }));
});

registerStep('windowCount', async (step, ctx) => {
  ctx.vars[step.var || 'used'] = getUses(ctx.actor, windowFlag(step.flag, ctx), step.window ?? 'encounter');
}, {
  errors: (step, where) => [
    ...(typeof step.flag == 'string' && step.flag ? [] : [`${where}: windowCount needs a flag`]),
    ...(['scene', 'encounter', 'mission'].includes(step.window ?? 'encounter') ? [] : [`${where}: windowCount window must be scene, encounter or mission`]),
  ],
});

registerTag('item:upgradeCostAtMost', (rest, ctx) => {
  const entry = ctx?.item;
  if (!entry) {
    return null;
  }

  const most = resolveValue(rest, { actor: ctx.self, item: ctx.ruleItem, vars: ctx.vars ?? {} }, 0);
  return upgradeCost(entry.system?.availability) <= most;
});
