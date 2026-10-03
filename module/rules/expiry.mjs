import { epochFor } from "../helpers/scene-clock.mjs";

/**
 * Durations for rule effects (docs/RULES_ENGINE_PLAN.md §5.4) - shared by banked bonuses
 * (rules/bank.mjs), on/off states set by a step (`setToggle` with `until`) and items given by a step
 * (`grant` with `until`).
 *
 *   until   "endOfTurn" | "endOfRound" | "nextTurn" | "encounter" | "scene" | null (lasts until something else ends it)
 *           nextTurn: until the start of the next turn of the actor whose rule it is.
 *           endOfNextRound: through the rest of this round and all of the next.
 *
 * An effect is stamped when it starts and checked when it is read - nothing has to sweep it away for
 * it to stop counting. Turn and round need a running combat to be stamped against; one started out of
 * combat carries no stamp and lasts until something else ends it (used up, switched off).
 */

export const UNTIL = ['endOfTurn', 'endOfRound', 'endOfNextRound', 'nextTurn', 'encounter', 'scene'];

/** The stamp an effect starting now carries. */
export function stampFor(until, combat = globalThis.game?.combat, actor = null) {
  if (until == 'scene' || until == 'encounter') {
    return { epoch: epochFor(until) };
  }

  // The actor's place in the turn order: its next turn starts there (the next round's, if it's here or passed).
  if (until == 'nextTurn' && combat?.started) {
    const turns = Array.isArray(combat.turns) ? combat.turns : [];
    const holderTurn = turns.findIndex(combatant => combatant?.actor && actor && (combatant.actor === actor || combatant.actor.id == actor.id));
    return { combatId: combat.id, round: combat.round, turn: combat.turn, holderTurn };
  }

  if (['endOfTurn', 'endOfRound', 'endOfNextRound'].includes(until) && combat?.started) {
    return { combatId: combat.id, round: combat.round, turn: combat.turn };
  }

  return null;
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

  if (entry.until == 'scene' || entry.until == 'encounter') {
    return stamp.epoch != epochFor(entry.until);
  }

  if (entry.until == 'nextTurn') {
    if (!combat?.started || combat.id != stamp.combatId) {
      return true;
    }

    // Not in the turn order: the next round's start stands in for its turn.
    const holder = stamp.holderTurn >= 0 ? stamp.holderTurn : 0;
    const [round, turn] = stamp.holderTurn > stamp.turn ? [stamp.round, holder] : [stamp.round + 1, holder];
    return combat.round > round || (combat.round == round && combat.turn >= turn);
  }

  if (entry.until == 'endOfNextRound') {
    return !combat?.started || combat.id != stamp.combatId || combat.round > stamp.round + 1;
  }

  if (!combat?.started || combat.id != stamp.combatId || combat.round != stamp.round) {
    return true;
  }

  return entry.until == 'endOfTurn' && combat.turn != stamp.turn;
}
