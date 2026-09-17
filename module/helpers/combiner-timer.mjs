import { getMegaformParticipants } from "./megaform-participants.mjs";

/**
 * The Combiner join timer (PR CRB, "The Combiner Zord Feature", p.139): "Much like how a Zord will
 * not answer the call to battle unless it is for a worthy adversary, the Zords will not combine
 * into a Megaform without a suitably worthy foe to battle. To determine whether or not a foe is
 * worthy, the collective Zords must have already been in a combat scene for a standard length of
 * 1d6+1 game rounds before they are ready to combine into their Megaform. Each participant in the
 * Megaform rolls a separate amount of time, with the highest roll result setting when the
 * combination will take place (at the end of that round)."
 *
 * This existed nowhere in the codebase - linking a Zord to a Megaform combined it instantly - which
 * also left Fast Modulation (below) with no die to reduce, and so no way to do anything at all.
 *
 * Deliberately advisory rather than a hard block: the timer is rolled and displayed, and linking a
 * participant before the round it names warns instead of refusing. A GM legitimately sets up
 * Megaforms outside of combat (roster building, prep between sessions), and there is no "combat
 * scene" concept to distinguish that from combining early mid-fight - refusing the link outright
 * would break that ordinary workflow to enforce a rule the table can see and apply itself.
 */

/** Reduction order for Fast Modulation, per its own "d6 to d4, d4 to d2" wording. */
const COMBINE_DICE = ['d6', 'd4', 'd2'];
const FAST_MODULATION_ID = "Compendium.essence20.pr_crb.Item.38bDkuZ73CmGBOSe";
const COMBINE_READY_ROUND_FLAG = 'combineReadyRound';

/**
 * Fast Modulation (PR CRB, Zord Feature, p.137, prerequisite Combiner): "This Zord is always ready
 * to take the next step... The Zord Feature speeds up how long the Zord must be in combat before it
 * can join with others using its Combiner feature. Each time this Zord Feature is chosen, the type
 * of die is reduced by one type (d6 to d4, d4 to d2, etc.) to a minimum of 1."
 *
 * Counts EVERY copy of the Feature the Zord holds, since RAW's own "each time this Zord Feature is
 * chosen" is explicitly repeatable - unlike the single-instance Features actorHasZordFeature is
 * built for, so this counts matching items itself rather than asking whether one exists. Past the
 * end of the die list the result is a flat 1 ("to a minimum of 1"), i.e. no roll at all.
 * @param {Actor} zord
 * @returns {String|null}   The die to roll, or null when reduced to a flat 1.
 */
export function getCombineDie(zord) {
  const reductions = Array.from(zord?.items ?? []).filter(item => {
    const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
    return item.type == 'feature' && sourceId == FAST_MODULATION_ID;
  }).length;

  return COMBINE_DICE[reductions] ?? null;
}

/**
 * Rolls one participant's own join time: its (possibly Fast-Modulation-reduced) die, plus 1.
 * @param {Actor} zord
 * @returns {Promise<Number>}
 */
async function rollParticipantTime(zord) {
  const die = getCombineDie(zord);
  if (!die) {
    // Reduced past d2 - a flat 1 round, with nothing left to roll.
    return 1;
  }

  const roll = await new Roll(`1${die}+1`).evaluate();
  return roll.total;
}

/**
 * Rolls the join timer for a Megaform: every participant rolls separately, and the highest sets the
 * round the combination can take place at. Stored as an absolute round number so it stays correct
 * as the encounter advances; with no combat running there's no round to count from, so the timer is
 * cleared instead (the Zords aren't "in a combat scene" at all, which is what the rule measures).
 * @param {Actor} megaformActor
 * @returns {Promise<Number|null>}   The round combination becomes available, or null if not in combat.
 */
export async function rollCombineTimer(megaformActor) {
  // getMegaformParticipants needs a fully-formed Megaform (it reads system.subtype to tell a
  // Megazord's Zords from a Combiner's components). This runs from the drop path, where failing to
  // work out a timer must never be what stops a participant being linked.
  if (!megaformActor?.system?.subtype) {
    return null;
  }

  const participants = getMegaformParticipants(megaformActor);
  if (!participants.length) {
    return null;
  }

  if (!game.combat?.started) {
    await megaformActor.unsetFlag('essence20', COMBINE_READY_ROUND_FLAG);
    return null;
  }

  const times = [];
  for (const participant of participants) {
    times.push(await rollParticipantTime(participant));
  }

  const readyRound = game.combat.round + Math.max(...times);
  await megaformActor.setFlag('essence20', COMBINE_READY_ROUND_FLAG, readyRound);

  ChatMessage.create({
    content: game.i18n.format('E20.CombinerTimerRolled', {
      name: megaformActor.name,
      rounds: Math.max(...times),
      round: readyRound,
    }),
    speaker: ChatMessage.getSpeaker({ actor: megaformActor }),
  });

  return readyRound;
}

/**
 * The round this Megaform's combination becomes available, or null if no timer is running.
 * @param {Actor} megaformActor
 * @returns {Number|null}
 */
export function getCombineReadyRound(megaformActor) {
  return megaformActor?.getFlag?.('essence20', COMBINE_READY_ROUND_FLAG) ?? null;
}

/**
 * Whether the join timer has elapsed. True when no timer is running at all, so nothing outside an
 * encounter is ever treated as "too early" - see this file's own advisory note above.
 * @param {Actor} megaformActor
 * @returns {Boolean}
 */
export function isCombineReady(megaformActor) {
  const readyRound = getCombineReadyRound(megaformActor);
  if (readyRound === null) {
    return true;
  }

  return (game.combat?.round ?? 0) >= readyRound;
}

export { FAST_MODULATION_ID };
