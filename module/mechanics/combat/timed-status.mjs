/**
 * Round-limited Conditions.
 *
 * Every Condition this codebase applies from a spell or attack - Frightened, Blinded, Grappled, and
 * dozens more across dice.mjs - goes on with `actor.toggleStatusEffect(id, { active: true })` alone,
 * which creates the ActiveEffect with no `duration` at all. That's correct for the many Conditions
 * RAW itself leaves open-ended ("until you take an action to remove it," "until healed"), but a
 * handful of spells name an explicit round count - The Stare's 3 rounds of Frightened (Knights of
 * Canterlot p.48), Smoke Beam's 3 rounds of Blinded (Dark Skies Over Equestria p.22), Super Sticky
 * Celebration String's 4 rounds of Grappled/Immobilized/Impaired (Knights of Canterlot p.51) - and
 * for those, "no duration" silently became "forever."
 *
 * applyTimedCondition below is the one place that gap closes: it still creates the effect exactly
 * as toggleStatusEffect already did (so every existing single-Condition call site can switch to it
 * with no other change), then stamps a `duration.rounds`/`duration.startRound` onto the
 * ActiveEffect Foundry just created, the same two fields core's own combat-tracker duration UI
 * reads to count an effect down and delete it automatically at the end of its last round. This is
 * deliberately NOT rolled out to every existing toggleStatusEffect call in dice.mjs - most of them
 * apply a Condition RAW itself never puts a round limit on, and retrofitting all of them at once
 * would be a much larger, unrequested behavior change.
 *
 * With no running Combat, core's round-based duration has nothing to count against, so (book check
 * 2026-10-06: a round is 6 seconds, PR CRB p.179) the Condition carries a rules/expiry.mjs rounds:N
 * stamp instead and rules/plugins/book/followups.mjs#sweepTimedConditions removes it after N x 6
 * seconds of game time or when the scene ends, whichever comes first.
 */

/**
 * Applies a status Condition to a target, with an explicit round count when one is given and a
 * Combat is active to count it against.
 * @param {Actor} targetActor
 * @param {String} statusId   A core Condition id (e.g. 'frightened', 'blinded').
 * @param {Number} [rounds]   How many rounds the Condition should last, if RAW names one.
 * @param {Object} [timing]   {value, expiry, combatantId} from turnBoundTiming - used instead of rounds in a running combat.
 * @returns {Promise<void>}
 */
export async function applyTimedCondition(targetActor, statusId, rounds, timing = null) {
  await targetActor.toggleStatusEffect(statusId, { active: true });
  // timing (turnBoundTiming below): the Condition ends as one creature's next turn starts or ends.
  if (timing && game.combat?.started) {
    const bound = targetActor.effects?.find?.(candidate => candidate.statuses?.has(statusId));
    if (bound) {
      await bound.update({
        'duration.value': timing.value,
        'duration.units': 'rounds',
        'duration.expiry': timing.expiry,
        'start.combat': game.combat.id,
        'start.combatant': timing.combatantId,
        'start.round': game.combat.round,
        'start.turn': game.combat.turn,
      });
    }

    return;
  }

  if (!rounds) {
    return;
  }

  // No running combat (book check 2026-10-06, follow-ups): a round is 6 seconds, so the Condition carries a rounds:N
  // stamp and rules/plugins/book/followups.mjs#sweepTimedConditions takes it off after N x 6 s of game time or at the
  // scene's end (a combat started meanwhile counts the rounds still left).
  if (!game.combat?.started) {
    const loose = targetActor.effects?.find?.(candidate => candidate.statuses?.has(statusId));
    const count = Math.max(1, Math.round(Number(rounds) || 0));
    const { stampFor } = await import("../../rules/expiry.mjs");
    const stamp = loose ? stampFor(`rounds:${count}`, undefined, targetActor) : null;
    if (stamp) {
      await loose.update({ 'flags.essence20.oocConditionExpiry': { until: `rounds:${count}`, stamp } });
    }

    return;
  }

  const effect = targetActor.effects?.find?.(candidate => candidate.statuses?.has(statusId));
  if (effect) {
    await effect.update({
      'duration.rounds': rounds,
      'duration.startRound': game.combat.round,
      'duration.startTurn': game.combat.turn,
    });
  }
}

/**
 * Timing for a Condition that ends with one creature's next turn (book check 2026-10-06, durations): "until the start
 * of your next turn" (until: nextTurn) or "until the end of their next turn" (until: endOfNextTurn). v14's own effect
 * expiry (duration.expiry turnStart / turnEnd, matched against start.combatant) does the ending. Its next turn is this
 * round's when it hasn't acted yet, else the next round's. Null with no running combat or when the creature isn't in
 * it (the caller then falls back to plain rounds).
 * @param {String} until        nextTurn | endOfNextTurn (the ...OrScene spellings too)
 * @param {Actor} actor         Whose turn counts.
 * @param {Combat} [combat]
 * @returns {{value: Number, expiry: String, combatantId: String}|null}
 */
export function turnBoundTiming(until, actor, combat = globalThis.game?.combat) {
  const expiry = { nextTurn: 'turnStart', nextTurnOrScene: 'turnStart', endOfNextTurn: 'turnEnd', endOfNextTurnOrScene: 'turnEnd' }[until];
  if (!expiry || !combat?.started || !actor) {
    return null;
  }

  const turns = Array.isArray(combat.turns) ? combat.turns : [];
  const index = turns.findIndex(combatant => combatant?.actor && (combatant.actor === actor || combatant.actor.id == actor.id));
  if (index < 0 || !turns[index].id) {
    return null;
  }

  return { value: index > (Number(combat.turn) || 0) ? 0 : 1, expiry, combatantId: turns[index].id };
}
