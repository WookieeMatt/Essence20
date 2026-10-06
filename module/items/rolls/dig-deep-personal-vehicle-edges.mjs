import {
  registerRollSources, registerSceneAdvanced,
} from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { personalVehicleEdge, SUMMON } from "../../mechanics/companions/summons.mjs";
import { getCrewedVehicle } from "../../mechanics/vehicles/vehicle-upgrades.mjs";

/**
 * Suspected-bug fix pass 3, Transformers group (plus the personal vehicles that share its gap):
 *
 * - Personal vehicles (Galaxy Glider, Jet Jammer, Sharkcycle Rider, Strata/Vector Cycle): "you gain
 *   Edge on Driving Skill Tests when piloting it" / Galaxy Glider's Acrobatics - summons.mjs's
 *   personalVehicleEdge was never read by any roll.
 * - Dig Deep (TF/GI Joe/MLP/WTNV): "a Snag on all Skill Tests until the end of your next turn" - was
 *   one banked Snag on the next roll.
 * - Covering Fire (TF CRB p.68) and Watchful Eyes (TF CRB p.68) are rules on the Perks now: `miss` /
 *   `afterRoll` Triggers bank the Snag on the target.
 * - Predacon (Technorganic Secrets) is rules on the Perk now: a `hit` Trigger marks the target dice.mjs
 *   frightened, and a watch `turnEnd` Trigger takes Frightened off at the end of its next turn.
 * - Get To Know (Dark Skies Over Equestria): the spell's Edge lasts "1 Scene" - an unspent Edge now
 *   goes when the GM starts a new scene.
 */

// Rider marks (mechanics/combat/target-riders.mjs's own store) this file writes.
export const KIND = {
  digDeep: 'fix3DigDeep',
};
const MARKS_FLAG = 'riderMarks';
const GET_TO_KNOW_EDGE_FLAG = 'pendingGetToKnowEdge';

/* -------------------------------------------- */
/*  Small helpers                                */
/* -------------------------------------------- */

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const findSourced = (actor, uuid) => itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;

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

/* -------------------------------------------- */
/*  Personal vehicles                            */
/* -------------------------------------------- */

const VEHICLE_GRANTOR = {
  sharkCycle: SUMMON.sharkcycleRider,
  galaxyGlider: SUMMON.galaxyGlider,
  jetJammer: SUMMON.jetJammer,
  strataCycle: SUMMON.vectorStrataCycle,
  vectorCycle: SUMMON.vectorStrataCycle,
};

export function personalVehicleSources(actor, target, { rolledSkill } = {}) {
  if (!actor || !rolledSkill || actor.type == 'vehicle') {
    return { sources: [] };
  }

  const vehicle = getCrewedVehicle(actor)?.vehicle;
  if (!personalVehicleEdge(actor, rolledSkill, vehicle)) {
    return { sources: [] };
  }

  const key = vehicle.flags.essence20.personalVehicle;
  const grantor = findSourced(actor, VEHICLE_GRANTOR[key]);
  return { sources: [{ id: 'fix3PersonalVehicle', label: grantor?.name ?? vehicle.name, edge: true }] };
}

/* -------------------------------------------- */
/*  Dig Deep                                     */
/* -------------------------------------------- */

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

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

export function tfFixRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];

  sources.push(...personalVehicleSources(actor, target, ctx).sources);

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

/** Get To Know's unspent Edge lasts the spell's scene. */
export async function tfFixSceneAdvanced() {
  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[GET_TO_KNOW_EDGE_FLAG]) {
      await actor.unsetFlag('essence20', GET_TO_KNOW_EDGE_FLAG);
    }
  }
}

registerRollSources(tfFixRollSources);
registerSceneAdvanced(tfFixSceneAdvanced);
