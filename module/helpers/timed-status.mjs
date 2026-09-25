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
 * With no active Combat, core's round-based duration has nothing to count against - consistent with
 * this project's existing "no rounds to count outside combat" idiom (see aoe-expiry.mjs's own
 * identical rounds case), so the Condition is applied with no duration and lasts until a GM removes
 * it by hand, same as before.
 */

/**
 * Applies a status Condition to a target, with an explicit round count when one is given and a
 * Combat is active to count it against.
 * @param {Actor} targetActor
 * @param {String} statusId   A core Condition id (e.g. 'frightened', 'blinded').
 * @param {Number} [rounds]   How many rounds the Condition should last, if RAW names one.
 * @returns {Promise<void>}
 */
export async function applyTimedCondition(targetActor, statusId, rounds) {
  await targetActor.toggleStatusEffect(statusId, { active: true });
  if (!rounds || !game.combat) {
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
