/**
 * Tokens, sides, distance and targets for the item files. Light on purpose - imports nothing.
 *
 * The side checks read different things and are kept apart: isEnemyOf compares dispositions
 * (the token's, else the prototype's, 0 when neither); areEnemies compares placed tokens and falls
 * back to PC vs non-PC; sameSide compares dispositions and counts an actor as on its own side.
 * feetBetween answers null off the canvas; feetBetweenOrEstimate also falls back to straight-line
 * geometry when the grid can't measure.
 */

export function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/** The actor's token disposition, else its prototype token's, else 0. */
export function dispositionOf(actor) {
  return tokenOf(actor)?.document?.disposition ?? actor?.prototypeToken?.disposition ?? 0;
}

/** Hostile to each other: different dispositions, neither of them neutral. */
export function isEnemyOf(a, b) {
  const da = dispositionOf(a);
  const db = dispositionOf(b);
  return !!a && !!b && da != db && da != 0 && db != 0;
}

/** Enemies: placed tokens with different, non-neutral dispositions; unplaced, a PC and a non-PC. Never yourself. */
export function areEnemies(a, b) {
  if (!a || !b || a === b || (a.uuid && a.uuid == b.uuid)) {
    return false;
  }

  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (ta && tb) {
    const da = ta.document?.disposition;
    const db = tb.document?.disposition;
    return da !== db && da !== 0 && db !== 0;
  }

  return (a.type == 'playerCharacter') != (b.type == 'playerCharacter');
}

/** Same side of the fight (token disposition), the reading mechanics/combat/nearby-allies.mjs uses. */
export function sameSide(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a === b || a.uuid == b.uuid) {
    return true;
  }

  const dispositionOrNull = actor => tokenOf(actor)?.document?.disposition ?? actor?.prototypeToken?.disposition ?? null;
  const da = dispositionOrNull(a);
  return da != null && da == dispositionOrNull(b);
}

/** Distance between two actors' tokens in feet, or null when either isn't on the canvas. */
export function feetBetween(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb || !globalThis.canvas?.grid?.measurePath) {
    return null;
  }

  return canvas.grid.measurePath([ta.center, tb.center]).distance;
}

/** feetBetween, estimated from the token centres when the grid can't measure; null off the canvas. */
export function feetBetweenOrEstimate(a, b) {
  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (!ta || !tb) {
    return null;
  }

  const measure = globalThis.canvas?.grid?.measurePath;
  if (measure) {
    try {
      return measure.call(globalThis.canvas.grid, [ta.center, tb.center]).distance;
    } catch (error) {
      // fall through to the plain geometry below
    }
  }

  const size = globalThis.canvas?.grid?.size || 100;
  const dist = globalThis.canvas?.grid?.distance || 5;
  return Math.hypot(ta.center.x - tb.center.x, ta.center.y - tb.center.y) / size * dist;
}

/** The user's first targeted token's actor, if any. */
export function firstTargetedActor() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (targets ? [...targets][0] : null);
  return first?.actor ?? null;
}

/** The targeted actors on this client. */
export function targetedActors() {
  return [...(globalThis.game?.user?.targets ?? [])].map(token => token?.actor).filter(Boolean);
}

/** The actor the clicking user speaks for: a controlled token, else their assigned character. */
export function myActor() {
  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}
