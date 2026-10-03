import {
  registerApplyDialog, registerDialogToggles, registerPostRoll, registerRollSources, registerSceneAdvanced, registerTurnEnd,
} from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import { personalVehicleEdge, SUMMON } from "../../summons.mjs";
import { getCrewedVehicle } from "../../vehicle-upgrades.mjs";
import { grappleEscapeSkills } from "../rules/grappled.mjs";

/**
 * Suspected-bug fix pass 3, Transformers group (plus the personal vehicles that share its gap):
 *
 * - Personal vehicles (Galaxy Glider, Jet Jammer, Sharkcycle Rider, Strata/Vector Cycle): "you gain
 *   Edge on Driving Skill Tests when piloting it" / Galaxy Glider's Acrobatics - summons.mjs's
 *   personalVehicleEdge was never read by any roll.
 * - Dig Deep (TF/GI Joe/MLP/WTNV): "a Snag on all Skill Tests until the end of your next turn" - was
 *   one banked Snag on the next roll.
 * - Covering Fire (TF CRB p.68): "the target of your attack suffers a Snag if they attack on their
 *   next turn" - was one banked Snag on its next attack, whenever that came.
 * - Watchful Eyes (TF CRB p.68): "a Snag on their first Skill Test on their turn" - reused Debilitating
 *   Strike's flag, so it was labelled Debilitating Strike.
 * - Predacon (Technorganic Secrets): "they gain the Frightened Condition until the end of their next
 *   turn" - dice.mjs applies Frightened; nothing ever took it off.
 * - Dinobot / Maximal / Predacon: "Choose a ... Specialization ... You gain an Edge on Skill Tests
 *   when that Specialization comes into play" - was an automatic Edge on every test of the Skill.
 * - Experiment (TF CRB, Shove option): "Gain ↑1 when Shoving or attempting to break from a Grapple" -
 *   was ↑1 on Grapple-type attacks, which are neither.
 * - Get To Know (Dark Skies Over Equestria): the spell's Edge lasts "1 Scene" - an unspent Edge now
 *   goes when the GM starts a new scene.
 */

const TF_CRB = 'Compendium.essence20.tf_crb.Item.';
const TS = 'Compendium.essence20.technorganic_secrets.Item.';
export const FIX3_TF = {
  coveringFire: `${TF_CRB}cAm087BkiExKIJrY`,
  watchfulEyes: `${TF_CRB}RmHSzuVLnIoqeczy`,
  experiment: `${TF_CRB}EcSOADOOb3PZMolz`,
  dinobot: `${TS}tx4mlGvMhiWXA4mp`,
  maximal: `${TS}z3Ig9tbOEq4erPU5`,
  predacon: `${TS}jRD6G5Z6eblTvxeO`,
};

// Rider marks (helpers/target-riders.mjs's own store) this file writes.
export const KIND = {
  digDeep: 'fix3DigDeep',
  coveringFire: 'fix3CoveringFire',
  watchfulEyes: 'fix3WatchfulEyes',
  predaconFright: 'fix3PredaconFright',
};
const MARKS_FLAG = 'riderMarks';
const GET_TO_KNOW_EDGE_FLAG = 'pendingGetToKnowEdge';

const INFLUENCE_EDGE = [
  { key: 'dinobot', skills: ['brawn', 'survival'] },
  { key: 'maximal', skills: ['persuasion', 'science', 'technology'] },
  { key: 'predacon', skills: ['intimidation'] },
];

/* -------------------------------------------- */
/*  Small helpers                                */
/* -------------------------------------------- */

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

function itemsOf(actor) {
  const items = actor?.items;
  return Array.isArray(items?.contents) ? items.contents : (items && typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

const findSourced = (actor, uuid) => itemsOf(actor).find(item => sourceOf(item) == uuid) ?? null;

function label(key, data, fallback) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.${key}`;
  if (i18n?.has?.(full)) {
    return i18n.format(full, data);
  }

  return fallback;
}

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

/** A mark on someone this user may not own goes through the GM relay (targeted tokens only). */
async function writeMark(target, mark) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(target)) {
    const marks = (target.flags?.essence20?.[MARKS_FLAG] ?? []).filter(m => !(m.kind == mark.kind && m.by == mark.by));
    await relayToGm(target, 'setFlag', ['essence20', MARKS_FLAG, [...marks, mark]]);
    return;
  }

  const { addMark } = await import("../../target-riders.mjs");
  await addMark(target, mark);
}

/** Whether it is this actor's turn in the running combat (always true out of combat). */
function isOwnTurn(actor) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return true;
  }

  return combat.combatant?.actor?.id == actor?.id;
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
 * Dig Deep's Snag, from its Use button (helpers/banked-buffs.mjs). In combat it runs to the end of
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
  const { addMark } = await import("../../target-riders.mjs");
  await addMark(actor, mark);
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

export function tfFixRollSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';

  sources.push(...personalVehicleSources(actor, target, ctx).sources);

  if (ctx.rolledSkill) {
    const digDeep = liveMark(actor, KIND.digDeep);
    if (digDeep) {
      sources.push({ id: 'fix3DigDeep', label: digDeep.label ?? 'Dig Deep', snag: true });
      if (digDeep.once) {
        consumes.push(consumeOf(actor, digDeep));
      }
    }

    // "their first Skill Test on their turn": waits for their turn, then goes with that test.
    const watchful = liveMark(actor, KIND.watchfulEyes);
    if (watchful && isOwnTurn(actor)) {
      sources.push({ id: 'fix3WatchfulEyes', label: watchful.label ?? 'Watchful Eyes', snag: true });
      consumes.push(consumeOf(actor, watchful));
    }
  }

  // "if they attack on their next turn": every attack in that turn.
  const covering = isAttack ? liveMark(actor, KIND.coveringFire) : null;
  if (covering && isOwnTurn(actor)) {
    sources.push({ id: 'fix3CoveringFire', label: covering.label ?? 'Covering Fire', snag: true });
    if (covering.once) {
      consumes.push(consumeOf(actor, covering));
    }
  }

  // Experiment, Shove option: "Gain ↑1 when Shoving".
  const experiment = ctx.isShove ? findSourced(actor, FIX3_TF.experiment) : null;
  if (experiment?.system?.choice == 'shove') {
    sources.push({ id: 'fix3ExperimentShove', label: experiment.name, shiftUp: 1 });
  }

  return { sources, consumes };
}

/* -------------------------------------------- */
/*  After the roll                               */
/* -------------------------------------------- */

function isEnemyToken(token, myToken) {
  return !!token?.actor && token.document?.disposition != myToken?.document?.disposition;
}

export async function tfFixPostRoll(actor, results, checkContext, { hits = [] } = {}) {
  // Covering Fire: a miss marks the target until the end of its next turn.
  const coveringFire = checkContext?.isAttack ? findSourced(actor, FIX3_TF.coveringFire) : null;
  if (coveringFire) {
    for (const { target, hit } of hits) {
      if (hit || !target) {
        continue;
      }

      const window = nextTurnWindow(target);
      await writeMark(target, {
        kind: KIND.coveringFire, by: actor.uuid, label: coveringFire.name, sceneEpoch: sceneEpoch(), ...window,
        ...(window.combatId ? {} : { once: true }),
      });
    }
  }

  // Watchful Eyes: a successful DIF 10 Alertness test marks each targeted enemy.
  const watchfulEyes = checkContext?.isWatchfulEyesAttempt && results?.[0]?.success ? findSourced(actor, FIX3_TF.watchfulEyes) : null;
  if (watchfulEyes) {
    const myToken = actor.getActiveTokens?.()?.[0];
    for (const token of globalThis.game?.user?.targets ?? []) {
      if (isEnemyToken(token, myToken)) {
        await writeMark(token.actor, {
          kind: KIND.watchfulEyes, by: actor.uuid, label: watchfulEyes.name, sceneEpoch: sceneEpoch(), ...nextTurnWindow(token.actor),
        });
      }
    }
  }

  // Predacon: dice.mjs gives each target beaten Frightened; note when it ends.
  const predacon = checkContext?.isPredaconAttempt ? findSourced(actor, FIX3_TF.predacon) : null;
  if (predacon) {
    for (const { target, hit } of hits) {
      if (hit && target) {
        await writeMark(target, { kind: KIND.predaconFright, by: actor.uuid, label: predacon.name, ...nextTurnWindow(target) });
      }
    }
  }
}

/**
 * The end of a turn: Predacon's Frightened comes off at the end of the target's next turn. Runs once,
 * on the active GM (documents/combat.mjs#_onEndTurn), after the turn has moved on - so the mark is
 * read raw and compared with the turn that just ended.
 */
export async function tfFixTurnEnd(actor, combat, context = {}) {
  const marks = actor?.flags?.essence20?.[MARKS_FLAG];
  if (!Array.isArray(marks)) {
    return;
  }

  const round = context.round ?? combat?.round;
  const done = marks.filter(mark => mark?.kind == KIND.predaconFright
    && (mark.combatId != combat?.id || round >= mark.untilRound));
  if (!done.length) {
    return;
  }

  await actor.setFlag('essence20', MARKS_FLAG, marks.filter(mark => !done.includes(mark)));
  if (actor.statuses?.has?.('frightened')) {
    await actor.toggleStatusEffect('frightened', { active: false });
  }
}

/** Get To Know's unspent Edge lasts the spell's scene. */
export async function tfFixSceneAdvanced() {
  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[GET_TO_KNOW_EDGE_FLAG]) {
      await actor.unsetFlag('essence20', GET_TO_KNOW_EDGE_FLAG);
    }
  }
}

/* -------------------------------------------- */
/*  Roll Options Dialog switches                 */
/* -------------------------------------------- */

export function tfFixToggles(actor, { rolledSkill, item, dataset } = {}) {
  if (!rolledSkill || !actor) {
    return [];
  }

  const toggles = [];
  const isAttack = item?.type == 'weaponEffect';

  // Dinobot / Maximal / Predacon: the Perk's pick is a Skill; the Edge is for the one Specialization
  // chosen from it, which only the player knows. On by default when rolling a Specialization.
  for (const { key, skills } of INFLUENCE_EDGE) {
    const perk = findSourced(actor, FIX3_TF[key]);
    if (perk && skills.includes(rolledSkill) && perk.system?.choice == rolledSkill) {
      toggles.push({
        name: `fix3Influence-${key}`, type: 'checkbox', value: !!dataset?.specializationKey,
        label: label('Fix3TfSpecializationEdge', { name: perk.name }, `${perk.name}: Edge (your chosen Specialization comes into play)`),
      });
    }
  }

  // Experiment, Shove option: "attempting to break from a Grapple" - a non-attack test with an escape
  // Skill while Grappled, on by default the same way the Grappled switch assumes an escape.
  const experiment = findSourced(actor, FIX3_TF.experiment);
  if (experiment?.system?.choice == 'shove' && actor.statuses?.has?.('grappled') && !isAttack
    && grappleEscapeSkills(actor).includes(rolledSkill)) {
    toggles.push({
      name: 'fix3ExperimentEscape', type: 'checkbox', value: true,
      label: label('Fix3TfExperimentEscape', { name: experiment.name }, `${experiment.name}: ↑1 (breaking free of the grapple)`),
    });
  }

  return toggles;
}

function giveEdge(options) {
  if (options.snag) {
    options.snag = false;
  } else {
    options.edge = true;
  }
}

export function tfFixApplyDialog(actor, options) {
  const ext = options.ext ?? {};
  const influence = INFLUENCE_EDGE.some(({ key }) => ext[`fix3Influence-${key}`]);
  if (influence) {
    giveEdge(options);
  }

  if (ext.fix3ExperimentEscape) {
    options.shiftUp = (Number(options.shiftUp) || 0) + 1;
  }
}

registerRollSources(tfFixRollSources);
registerPostRoll(tfFixPostRoll);
registerTurnEnd(tfFixTurnEnd);
registerSceneAdvanced(tfFixSceneAdvanced);
registerDialogToggles(tfFixToggles);
registerApplyDialog(tfFixApplyDialog);
