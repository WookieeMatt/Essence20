import { epochFor } from "../mechanics/resources/scene-clock.mjs";

/**
 * Durations for rule effects (docs/RULES_ENGINE_PLAN.md §5.4) - shared by banked bonuses
 * (rules/bank.mjs), on/off states set by a step (`setToggle` with `until`) and items given by a step
 * (`grant` with `until`).
 *
 *   until   "endOfTurn" | "endOfRound" | "nextTurn" | "encounter" | "scene" | null (lasts until something else ends it)
 *           nextTurn: until the start of the next turn of the actor whose rule it is.
 *           endOfNextTurn: through the end of that actor's next turn (its current one doesn't count).
 *           endOfNextRound: through the rest of this round and all of the next.
 *           turnOrScene / roundOrScene: endOfTurn / endOfRound in a running combat, else the scene.
 *           rounds:N: for N rounds (until the same point in the turn order N rounds on); out of combat N x 6 seconds
 *           of game time, also ending with the scene (a combat starting meanwhile gets the rounds still left).
 *           combat: while the combat it started in exists (started or not); with no combat, until ended otherwise.
 *           nextTurnOrScene: nextTurn in a running combat, else the scene.
 *           endOfNextTurnOrScene: endOfNextTurn in a running combat (also ending with the scene), else the scene.
 *           turnOrUntilCombat: endOfTurn in a running combat; out of combat, until a combat starts.
 *           worldTime:<seconds>: until that much game-world time has passed (a week of downtime).
 *
 * An effect is stamped when it starts and checked when it is read - nothing has to sweep it away for
 * it to stop counting. Turn and round need a running combat to be stamped against; one started out of
 * combat carries no stamp and lasts until something else ends it (used up, switched off) - except the
 * "...OrScene" ones, which last the scene instead, and rounds:N (6 seconds a round, or the scene).
 *
 * Whose turn: the `actor` given to stampFor (the rule's holder, or a step's recipient with untilOf: "target").
 */

export const UNTIL = ['mission', 'endOfTurn', 'endOfRound', 'endOfNextRound', 'nextTurn', 'endOfNextTurn', 'turnOrScene', 'roundOrScene', 'nextTurnOrScene', 'endOfNextTurnOrScene', 'turnOrUntilCombat', 'combat', 'encounter', 'scene'];

/** Seconds in a "worldTime:N" duration (0 for anything else). */
function secondsOf(until) {
  const match = /^worldTime:(\d+)$/.exec(String(until ?? ''));
  return match ? Number(match[1]) : 0;
}

/** Seconds in a combat round (Core Rulebook, Time: 10 rounds make a minute). */
const ROUND_SECONDS = 6;

/** Rounds in a "rounds:N" duration (0 for anything else). */
function roundsOf(until) {
  const match = /^rounds:(\d+)$/.exec(String(until ?? ''));
  return match ? Number(match[1]) : 0;
}

/**
 * Plug-in durations (module/rules/plugins/*): `stamp(combat, actor)` makes the stamp an effect starting now carries
 * (it is kept as {custom: name, ...}); `expired(stamp, combat)` says whether it has run out.
 */
const EXTRA_UNTIL = new Map();
export function registerUntil(name, { stamp, expired }) {
  if (!UNTIL.includes(name)) {
    UNTIL.push(name);
  }

  EXTRA_UNTIL.set(name, { stamp, expired });
}

/** Whether `until` is a duration this module knows. */
export function isValidUntil(until) {
  return UNTIL.includes(until) || roundsOf(until) > 0 || secondsOf(until) > 0;
}

/** Falls back to the scene when there's no running combat. */
function scenesOutOfCombat(until) {
  return ['turnOrScene', 'roundOrScene', 'nextTurnOrScene', 'endOfNextTurnOrScene'].includes(until) || roundsOf(until) > 0;
}

function turnIndexOf(combat, actor) {
  const turns = Array.isArray(combat?.turns) ? combat.turns : [];
  return turns.findIndex(combatant => combatant?.actor && actor && (combatant.actor === actor || combatant.actor.id == actor.id));
}

/** The stamp an effect starting now carries. */
export function stampFor(until, combat = globalThis.game?.combat, actor = null) {
  if (EXTRA_UNTIL.has(until)) {
    return { ...EXTRA_UNTIL.get(until).stamp(combat, actor), custom: until };
  }

  if (until == 'scene' || until == 'encounter' || until == 'mission') {
    return { epoch: epochFor(until) };
  }

  if (secondsOf(until)) {
    return { worldTime: (Number(globalThis.game?.time?.worldTime) || 0) + secondsOf(until) };
  }

  // turnOrUntilCombat out of combat: lasts until a combat starts (stamped with "no combat").
  if (until == 'turnOrUntilCombat' && !combat?.started) {
    return { untilCombat: true };
  }

  // A combat set up but not started counts for "combat".
  if (until == 'combat') {
    return combat ? { combatId: combat.id, combat: true } : null;
  }

  // A combat set up but not started: the turn-based ones count from its first round (the order isn't known yet).
  if (combat && !combat.started && ['nextTurn', 'endOfNextTurn'].includes(until)) {
    return { combatId: combat.id, unstarted: true, actorId: actor?.id ?? null };
  }

  // rounds:N out of combat (book check 2026-10-06, durations): a round is 6 seconds (Core Rulebook, Time), so it lasts
  // N x 6 seconds of game time, also ending with the scene; a combat starting meanwhile counts the rounds still left.
  if (!combat?.started && roundsOf(until)) {
    return { oocRounds: roundsOf(until), time: Number(globalThis.game?.time?.worldTime) || 0, sceneEpoch: epochFor('scene') };
  }

  if (!combat?.started) {
    return scenesOutOfCombat(until) ? { epoch: epochFor('scene') } : null;
  }

  // The actor's place in the turn order: its next turn starts there (the next round's, if it's here or passed).
  if (until == 'nextTurn' || until == 'endOfNextTurn' || until == 'nextTurnOrScene' || until == 'endOfNextTurnOrScene') {
    // endOfNextTurnOrScene also ends with the scene it started in.
    const epoch = until == 'endOfNextTurnOrScene' ? { sceneEpoch: epochFor('scene') } : {};
    return { combatId: combat.id, round: combat.round, turn: combat.turn, holderTurn: turnIndexOf(combat, actor), ...epoch };
  }

  if (until == 'turnOrUntilCombat') {
    return { combatId: combat.id, round: combat.round, turn: combat.turn };
  }

  if (['endOfTurn', 'endOfRound', 'endOfNextRound', 'turnOrScene', 'roundOrScene'].includes(until) || roundsOf(until)) {
    return { combatId: combat.id, round: combat.round, turn: combat.turn };
  }

  return null;
}

/** The (round, turn) of the stamped actor's next turn. Not in the turn order: the next round's start. */
function nextTurnOf(stamp) {
  const holder = stamp.holderTurn >= 0 ? stamp.holderTurn : 0;
  return stamp.holderTurn > stamp.turn ? [stamp.round, holder] : [stamp.round + 1, holder];
}

/**
 * Whether an effect has run out.
 * @param {Object} entry   {until, stamp}
 */
export function isExpired(entry, combat = globalThis.game?.combat) {
  if (!entry?.until) {
    return false;
  }

  const stamp = entry.stamp;
  if (!stamp) {
    return false;
  }

  if (stamp.custom && EXTRA_UNTIL.has(stamp.custom)) {
    return !!EXTRA_UNTIL.get(stamp.custom).expired(stamp, combat);
  }

  // Scene-long (also the out-of-combat fallback of turnOrScene / roundOrScene / rounds:N).
  if (stamp.epoch !== undefined) {
    return stamp.epoch != epochFor(['encounter', 'mission'].includes(entry.until) ? entry.until : 'scene');
  }

  if (stamp.untilCombat) {
    return !!combat?.started;
  }

  // rounds:N begun out of combat: N x 6 seconds of game time, or the scene, whichever ends first. In a running combat
  // (which moves no game time in this system) the rounds not yet used up out of combat last from its first round.
  if (stamp.oocRounds) {
    if (stamp.sceneEpoch !== undefined && stamp.sceneEpoch != epochFor('scene')) {
      return true;
    }

    const left = stamp.oocRounds - Math.floor(Math.max(0, (Number(globalThis.game?.time?.worldTime) || 0) - (stamp.time ?? 0)) / ROUND_SECONDS);
    if (left <= 0) {
      return true;
    }

    return !!combat?.started && (Number(combat.round) || 0) > left;
  }

  if (stamp.sceneEpoch !== undefined && stamp.sceneEpoch != epochFor('scene')) {
    return true;
  }

  if (stamp.worldTime !== undefined) {
    return (Number(globalThis.game?.time?.worldTime) || 0) >= stamp.worldTime;
  }

  if (stamp.combat) {
    const combats = globalThis.game?.combats;
    return combats?.get ? !combats.get(stamp.combatId) : combat?.id != stamp.combatId;
  }

  // Stamped before the combat started: not yet run out; once it starts, as if stamped just before round 1.
  if (stamp.unstarted) {
    if (!combat || combat.id != stamp.combatId) {
      return true;
    }

    if (!combat.started) {
      return false;
    }

    const holderTurn = turnIndexOf(combat, { id: stamp.actorId });
    return isExpired({ until: entry.until, stamp: { combatId: combat.id, round: 1, turn: -1, holderTurn } }, combat);
  }

  if (!combat?.started || combat.id != stamp.combatId) {
    return true;
  }

  const round = Number(combat.round) || 0;
  const turn = Number(combat.turn) || 0;
  if (entry.until == 'endOfNextTurn' && !(stamp.holderTurn >= 0)) {
    // Not in the turn order: through the end of the next round.
    return round > stamp.round + 1;
  }

  if (['nextTurn', 'endOfNextTurn', 'nextTurnOrScene', 'endOfNextTurnOrScene'].includes(entry.until)) {
    const [nextRound, nextTurn] = nextTurnOf(stamp);
    // nextTurn ends as that turn starts; endOfNextTurn once the turn after it starts.
    return !['endOfNextTurn', 'endOfNextTurnOrScene'].includes(entry.until)
      ? round > nextRound || (round == nextRound && turn >= nextTurn)
      : round > nextRound || (round == nextRound && turn > nextTurn);
  }

  const rounds = roundsOf(entry.until);
  if (rounds) {
    return round > stamp.round + rounds || (round == stamp.round + rounds && turn >= stamp.turn);
  }

  if (entry.until == 'endOfNextRound') {
    return round > stamp.round + 1;
  }

  if (round != stamp.round) {
    return true;
  }

  return ['endOfTurn', 'turnOrScene', 'turnOrUntilCombat'].includes(entry.until) && turn != stamp.turn;
}
