import { registerRollSources } from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";

/**
 * Dig Deep (TF/GI Joe/MLP/WTNV): "a Snag on all Skill Tests until the end of your next turn" - was
 * one banked Snag on the next roll. The Use button (mechanics/resources/banked-buffs.mjs) marks it here.
 *
 * (Covering Fire (TF CRB p.68) and Watchful Eyes (TF CRB p.68) are rules on the Perks now: `miss` /
 * `afterRoll` Triggers bank the Snag on the target. Predacon (Technorganic Secrets) is rules on the Perk
 * now: a `hit` Trigger marks the target dice.mjs frightened, and a watch `turnEnd` Trigger takes
 * Frightened off at the end of its next turn.)
 */

// Rider marks (mechanics/combat/target-riders.mjs's own store) this file writes.
export const KIND = {
  digDeep: 'fix3DigDeep',
};
const MARKS_FLAG = 'riderMarks';

function sceneEpoch() {
  try {
    return getSceneEpoch();
  } catch {
    return null;
  }
}

/**
 * "Until the end of [their] next turn", counted from now: a creature whose turn is still to come
 * this round has its next turn this round; otherwise it is next round's. Empty out of combat.
 * @param {Actor} actor
 * @returns {Object}   {combatId, untilRound, untilTurn} in target-riders' mark shape.
 */
export function nextTurnWindow(actor) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return {};
  }

  const turns = combat.turns ?? [];
  const current = Number(combat.round) || 0;
  const turn = Number(combat.turn) || 0;
  const index = turns.findIndex(c => c.actor?.id == actor?.id);
  if (index < 0) {
    return { combatId: combat.id, untilRound: current + 1, untilTurn: turn };
  }

  const round = index > turn ? current : current + 1;
  return { combatId: combat.id, untilRound: round, untilTurn: index };
}

/** Same liveness rule as target-riders' own getMarks, read without importing it (import-cycle note). */
function isLive(mark) {
  const combat = globalThis.game?.combat;
  if (mark.combatId && (!combat || combat.id != mark.combatId)) {
    return false;
  }

  if (mark.sceneEpoch != null && mark.sceneEpoch != sceneEpoch()) {
    return false;
  }

  if (mark.untilRound != null && combat) {
    if (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn)) {
      return false;
    }
  }

  return true;
}

export function liveMark(actor, kind) {
  const marks = actor?.flags?.essence20?.[MARKS_FLAG];
  return Array.isArray(marks) ? marks.find(mark => mark?.kind == kind && isLive(mark)) ?? null : null;
}

/** A mark that spends itself on the roll that used it. */
function consumeOf(actor, mark) {
  return { actorUuid: actor.uuid, kind: mark.kind, by: mark.by ?? null };
}

/**
 * Dig Deep's Snag, from its Use button (mechanics/resources/banked-buffs.mjs). In combat it runs to the end of
 * the holder's next turn; out of combat there are no turns, so it is spent by the next Skill Test.
 * @param {Actor} actor
 * @param {Item} [item]
 */
export async function markDigDeepSnag(actor, item = null) {
  const window = nextTurnWindow(actor);
  const mark = {
    kind: KIND.digDeep, by: actor.uuid, label: item?.name ?? 'Dig Deep', sceneEpoch: sceneEpoch(), ...window,
    ...(window.combatId ? {} : { once: true }),
  };
  const { addMark } = await import("../../mechanics/combat/target-riders.mjs");
  await addMark(actor, mark);
}

/** The Snag on every Skill Test while the mark lasts (spent by the roll when it is a one-off). */
export function digDeepRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];

  if (ctx.rolledSkill) {
    const digDeep = liveMark(actor, KIND.digDeep);
    if (digDeep) {
      sources.push({ id: 'fix3DigDeep', label: digDeep.label ?? 'Dig Deep', snag: true });
      if (digDeep.once) {
        consumes.push(consumeOf(actor, digDeep));
      }
    }
  }

  return { sources, consumes };
}

registerRollSources(digDeepRollSources);
