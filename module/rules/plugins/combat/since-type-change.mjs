import { ruleMovement } from "../../adapter.mjs";

/**
 * Round 15 (items2): MovementAction {countSinceTypeChange: true} (Third Dimension) - when a token's move is measured
 * against its speed (mechanics/combat/token-movement.mjs fires essence20.movementUsed), only the cost walked since the
 * last change of Movement type (the waypoints' movement action) counts against the current type, never more than the
 * whole move.
 */

/** The cost walked since the last change of movement action, or null with no waypoints that name one. */
export function usedSinceTypeChange(movement) {
  const waypoints = [
    ...(movement?.history?.recorded?.waypoints ?? []), ...(movement?.history?.unrecorded?.waypoints ?? []),
    ...(movement?.passed?.waypoints ?? []), ...(movement?.pending?.waypoints ?? []),
  ];
  const last = [...waypoints].reverse().find(waypoint => waypoint?.action)?.action;
  if (!last) {
    return null;
  }

  let used = 0;
  for (const waypoint of [...waypoints].reverse()) {
    if (waypoint?.action && waypoint.action != last) {
      break;
    }

    used += Number(waypoint?.cost) || 0;
  }

  return used;
}

export function onMovementUsed(actor, movement, out) {
  if (!out || !actor || !ruleMovement(actor).countSinceTypeChange) {
    return;
  }

  const used = usedSinceTypeChange(movement);
  if (Number.isFinite(used)) {
    out.used = Math.min(out.used ?? used, used);
  }
}

globalThis.Hooks?.on?.('essence20.movementUsed', onMovementUsed);
