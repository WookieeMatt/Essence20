import { registerDamageModifier } from "../../extensions.mjs";
import { T, post } from "./shared.mjs";
// Roll Cage is a CrashProtection rule on its pack item (rules/ext/b/readers.mjs).
import { crashProtectionOf } from "../../../rules/ext/b/readers.mjs";

/**
 * Roll Cage (GI JOE CRB, Mechanized Infantry Focus, 7th level, p.81): "if your vehicle crashes, you
 * and any passengers take no damage. If your vehicle explodes, you and all passengers exit safely and
 * only suffer 1 damage." (Peerless Pilot's automatic emergency disembark is its AutoDisembark rule.)
 *
 * helpers/vehicle-defeat.mjs runs a vehicle's defeat as one awaited sequence on one client: the
 * vehicle is marked Defeated, then it either crashes (system.crashed, crash and disembark damage) or
 * explodes (Fire damage to everything near it). While that runs, the vehicle's crew is remembered
 * here; a crew member's damage is then waived (crash) or cut to 1 (explosion) when the vehicle's
 * driver holds Roll Cage.
 */

const WINDOW_MS = 20000;
// vehicle uuid -> {crew: Set<actor uuid>, mode: 'defeat'|'crash', until}
export const RESOLVING = new Map();

function crewEntries(vehicle) {
  return Object.values(vehicle?.system?.actors ?? {}).filter(entry => entry?.uuid);
}

function crewActor(entry) {
  return globalThis.fromUuidSync?.(entry.uuid) ?? null;
}

/** The pilot - a crew member seated as driver; the whole crew when no roles are recorded. */
export function pilotsOf(vehicle) {
  const entries = crewEntries(vehicle);
  const drivers = entries.filter(entry => entry.vehicleRole == 'driver');
  return (drivers.length ? drivers : entries).map(crewActor).filter(Boolean);
}

export function rollCageProtects(vehicle) {
  return pilotsOf(vehicle).some(pilot => !!crashProtectionOf(pilot));
}

function open(vehicle, mode) {
  if (!rollCageProtects(vehicle)) {
    return;
  }

  const crew = new Set(crewEntries(vehicle).map(entry => crewActor(entry)?.uuid ?? entry.uuid));
  RESOLVING.set(vehicle.uuid, { crew, mode, until: Date.now() + WINDOW_MS, vehicle });
}

globalThis.Hooks?.on?.('createActiveEffect', (effect) => {
  const vehicle = effect?.parent;
  if (vehicle?.type == 'vehicle' && effect.statuses?.has?.('defeated')) {
    open(vehicle, 'defeat');
  }
});

globalThis.Hooks?.on?.('updateActor', (vehicle, changes) => {
  if (vehicle?.type == 'vehicle' && changes?.system?.crashed === true) {
    const current = RESOLVING.get(vehicle.uuid);
    if (current) {
      current.mode = 'crash';
      current.until = Date.now() + WINDOW_MS;
    } else {
      open(vehicle, 'crash');
    }
  }
});

// The sequence ends with its own chat line - the window closes there.
globalThis.Hooks?.on?.('createChatMessage', (message) => {
  const speaker = message?.speaker?.actor;
  for (const [uuid, window] of RESOLVING) {
    if (window.vehicle?.id == speaker && /crash|explod/i.test(String(message.content ?? ''))) {
      RESOLVING.delete(uuid);
    }
  }
});

/**
 * @returns {Number}   The damage a crew member actually takes while their vehicle's defeat resolves.
 */
export function rollCageDamage(actor, amount, damageType) {
  const now = Date.now();
  for (const [uuid, window] of RESOLVING) {
    if (window.until < now) {
      RESOLVING.delete(uuid);
      continue;
    }

    if (!actor?.uuid || !window.crew.has(actor.uuid)) {
      continue;
    }

    if (window.mode == 'crash') {
      return 0;
    }

    if (damageType == 'fire') {
      return Math.min(amount, 1);
    }
  }

  return amount;
}

registerDamageModifier((actor, amount, damageType) => {
  const next = rollCageDamage(actor, amount, damageType);
  if (next != amount) {
    const protector = [...RESOLVING.values()].map(w => w.vehicle).map(pilotsOf).flat().map(crashProtectionOf).find(Boolean);
    post(actor, T('E20.Gij2RollCage', { name: actor.name, perk: protector?.name ?? 'Roll Cage', amount: next }));
  }

  return next;
});
