/**
 * Combat-turn stamps the item files share: a record of "now" in the combat, and the "until"
 * windows built from one. Light on purpose - imports nothing.
 *
 * The plain stamps differ only in what they answer outside combat: turnStamp gives null,
 * combatStamp gives { combatId: null }, roundStamp gives { combatId: null, round: null }. Each
 * window has its own stamp-maker and liveness check - they are not interchangeable.
 */

/* -------------------------------------------- */
/*  "Now"                                       */
/* -------------------------------------------- */

/** This combat's current turn, as a comparable stamp; null out of combat. */
export function turnStamp() {
  const combat = globalThis.game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

/** turnStamp, but { combatId: null } out of combat. */
export function combatStamp() {
  const combat = globalThis.game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : { combatId: null };
}

/** The combat round stamp used for "until" windows; { combatId: null, round: null } out of combat. */
export function roundStamp() {
  const combat = globalThis.game?.combat;
  return combat ? { combatId: combat.id, round: combat.round } : { combatId: null, round: null };
}

/** Whether two stamps name the same combat turn. */
export function sameTurn(a, b) {
  return !!a && !!b && a.combatId == b.combatId && a.round == b.round && a.turn == b.turn;
}

/* -------------------------------------------- */
/*  "Until the end of your next turn" (round)   */
/* -------------------------------------------- */

/** "Until the end of your next turn" as a combat stamp; outside combat, the scene. */
export function stampNow(sceneEpoch = null) {
  const combat = game.combat;
  return combat ? { combatId: combat.id, round: combat.round ?? 0 } : { scene: sceneEpoch };
}

/** Whether a stampNow() window is still open: this round or the next, or the same scene. */
export function stampOpen(stamp, sceneEpoch = null) {
  if (!stamp) {
    return false;
  }

  const combat = game.combat;
  if (stamp.combatId) {
    return !!combat && combat.id == stamp.combatId && (combat.round ?? 0) <= (stamp.round ?? 0) + 1;
  }

  return !combat && stamp.scene === sceneEpoch;
}

/* -------------------------------------------- */
/*  "Until the end of your next turn" (turn)    */
/* -------------------------------------------- */

/** "Until the end of your next turn" as a combat stamp; null out of combat. */
export function untilEndOfNextTurn(actor) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return null;
  }

  const index = (combat.turns ?? []).findIndex(c => c.actor?.id == actor?.id);
  return { combatId: combat.id, round: combat.round + 1, turn: index < 0 ? combat.turn : index };
}

/** Whether a stamp from untilEndOfNextTurn is still running. A null stamp never expires here. */
export function stampLive(stamp) {
  if (!stamp) {
    return true;
  }

  const combat = globalThis.game?.combat;
  if (!combat || combat.id != stamp.combatId) {
    return false;
  }

  return combat.round < stamp.round || (combat.round == stamp.round && combat.turn <= stamp.turn);
}

/* -------------------------------------------- */
/*  "Until the start of your next turn"         */
/* -------------------------------------------- */

/** A stamp that stays live until the start of the actor's next turn (or for the scene, outside combat). */
export function untilNextTurnStamp(actor, sceneEpoch = null) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return { sceneEpoch };
  }

  const theirs = (combat.turns ?? []).findIndex(c => c.actor?.id == actor?.id);
  const turn = theirs < 0 ? combat.turn : theirs;
  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: turn - 1, sceneEpoch };
}

/** Whether an untilNextTurnStamp() window is still live. */
export function isStampLive(stamp, currentEpoch = null) {
  if (!stamp) {
    return false;
  }

  const combat = globalThis.game?.combat;
  if (stamp.combatId && (!combat || combat.id != stamp.combatId)) {
    return false;
  }

  if (stamp.sceneEpoch != null && currentEpoch != null && stamp.sceneEpoch != currentEpoch) {
    return false;
  }

  if (stamp.untilRound != null && combat) {
    if (combat.round > stamp.untilRound || (combat.round == stamp.untilRound && combat.turn > stamp.untilTurn)) {
      return false;
    }
  }

  return true;
}
