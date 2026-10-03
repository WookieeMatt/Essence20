/**
 * The tf2 slice's roll hooks: ↑/↓/Edge/Snag sources and Roll Options Dialog switches.
 *
 * - All Out Attack (p.107) / Evasive Fighting (p.109): "During your turn, you can voluntarily take
 *   Downshifts on your attacks with Might, Finesse, or Targeting. For each Downshift you take, you
 *   deal 1 additional damage to a single target hit by the attack, but enemies gain an equal number
 *   of Upshifts to attack you until the start of your next turn" / "...to force enemies to suffer
 *   the same number of Downshifts when attacking you." The G.I. JOE printings of the same two Perks
 *   already run on target-riders.mjs's stance flag; the TF printings feed that same flag.
 * - Broad Understanding (Scientist, p.79): "Outside of combat, as long as you have at least one
 *   Science Specialization, you roll all Science Skill Tests as though you were Specialized,
 *   although Skill Tests outside your Specialization suffer ↓2." Applied Science (12th level, p.79):
 *   "once per scene, you can use Broad Understanding and Thesis in Combat" (Use button, ./uses.mjs).
 * - Cage (p.134): "To escape, a prisoner must make an Infiltration Skill Test against your Cleverness
 *   or a Brawn Skill Test against your Toughness. They have ↓2 on those Skill Tests. Additionally, if
 *   you use a Free action to focus on a passenger, their roll suffers a Snag."
 * - Diversion (p.60): "On a success, if they attack you on their next turn, they suffer a Snag. If
 *   they don't attack you, your allies gain an Edge on attacks that target them. This lasts until the
 *   end of the next round." The mark is set by the Use button (./uses.mjs).
 * - Duke It Out (p.91): "If they refuse, you gain an Edge on Skill Tests targeting them until the
 *   beginning of your next turn."
 * - Deconstruct (p.81): "Weapon: The attacker suffers a Snag using this weapon unless it's subject to
 *   a DIF 10 Technology Skill Test to repair it."
 * - Sustained Beam (Enigma of Combination, weapon upgrade, p.54): the second attack is "with Edge".
 * - Bestial Articulation (Monstrosity Alt Mode, Decepticon Directive p.37, Technorganic Secrets p.41):
 *   "You must use body parts not designed for articulation or precision, such as mouths, claws, or
 *   hooves, to perform certain tasks. Whenever this applies, you suffer a penalty of ↓ 1." Which tasks
 *   is a table call, so it's a switch while converted into a Monstrosity Alt Mode.
 * - Arrogant (Enigma of Combination, Hang-Up, p.25): "On your first turn of a combat, after you test
 *   Initiative, you can't attack enemies whose Threat Level is lower than your level, though you can
 *   make an area of effect attack that includes such enemies if it also includes at least one enemy
 *   whose Threat Level is equal to or higher than your level." The roll can't be refused from an
 *   extension, so this warns before the dice land.
 */
import {
  registerApplyDialog, registerConsumer, registerDialogToggles, registerPreRoll, registerRollSources, registerSpecializes,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  T, TF2, has, isOwnTurn, nameOf, parentWeaponOf, targetedActors,
} from "./common.mjs";

export const MARK = {
  diversion: 'tf2Diversion',
  dukeRefused: 'tf2DukeRefused',
  caged: 'tf2Caged',
};
export const DECONSTRUCTED = 'tf2Deconstructed';
export const APPLIED_SCIENCE_FLAG = 'tf2AppliedScience';
export const SUSTAINED_BEAM_EDGE = 'tf2SustainedBeamEdge';
const ATTACK_SKILLS = ['might', 'finesse', 'targeting'];

const skillOf = item => item?.system?.classification?.skill ?? null;

/* -------------------------------------------- */
/*  Marks (target-riders.mjs's riderMarks flag)  */
/* -------------------------------------------- */

function isMarkLive(mark) {
  const combat = globalThis.game?.combat;
  if (mark?.combatId && (!combat || combat.id != mark.combatId)) {
    return false;
  }

  if (mark?.sceneEpoch != null && mark.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (mark?.untilRound != null && combat) {
    if (combat.round > mark.untilRound || (combat.round == mark.untilRound && combat.turn > mark.untilTurn)) {
      return false;
    }
  }

  return true;
}

/** The live marks of one kind on this actor (same flag and expiry as target-riders.mjs#getMarks). */
export function marksOf(actor, kind) {
  const marks = actor?.flags?.essence20?.riderMarks;
  return Array.isArray(marks) ? marks.filter(mark => mark?.kind == kind && isMarkLive(mark)) : [];
}

/** Put a mark on an actor (through the GM when the user doesn't own it), replacing its own earlier one. */
export async function addMarkTo(actor, mark) {
  const marks = actor?.flags?.essence20?.riderMarks;
  const kept = (Array.isArray(marks) ? marks : []).filter(existing => isMarkLive(existing) && !(existing.kind == mark.kind && existing.by == mark.by));
  const { writeActor } = await import("./common.mjs");
  return writeActor(actor, 'setFlag', ['essence20', 'riderMarks', [...kept, mark]]);
}

/** Take one kind of mark (optionally only one maker's) off an actor. */
export async function removeMarkFrom(actor, kind, by = null) {
  const marks = actor?.flags?.essence20?.riderMarks;
  if (!Array.isArray(marks)) {
    return;
  }

  const kept = marks.filter(mark => !(mark?.kind == kind && (!by || mark.by == by)));
  if (kept.length != marks.length) {
    const { writeActor } = await import("./common.mjs");
    await writeActor(actor, 'setFlag', ['essence20', 'riderMarks', kept]);
  }
}

/** "Until the end of the next round". */
export function untilEndOfNextRound() {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return { sceneEpoch: getSceneEpoch() };
  }

  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: Math.max(0, (combat.turns?.length ?? 1) - 1) };
}

/** "Until the beginning of your next turn". */
export function untilStartOfNextTurn(actor) {
  const combat = globalThis.game?.combat;
  if (!combat) {
    return { sceneEpoch: getSceneEpoch() };
  }

  const theirs = (combat.turns ?? []).findIndex(c => c.actor?.id == actor?.id);
  const turn = theirs < 0 ? combat.turn : theirs;
  return { combatId: combat.id, untilRound: combat.round + 1, untilTurn: turn - 1 };
}

/* -------------------------------------------- */
/*  Broad Understanding / Applied Science        */
/* -------------------------------------------- */

function hasScienceSpecialization(actor) {
  const specs = actor?.system?.skills?.science?.specializations;
  return !!specs && Object.keys(specs).length > 0;
}

/** Whether Broad Understanding applies to this actor's Science roll right now. */
export function broadUnderstandingApplies(actor) {
  if (!has(actor, TF2.broadUnderstanding) || !hasScienceSpecialization(actor)) {
    return false;
  }

  return !globalThis.game?.combat || !!actor?.flags?.essence20?.[APPLIED_SCIENCE_FLAG];
}

export function tf2Specializes(actor, skill) {
  return skill == 'science' && broadUnderstandingApplies(actor);
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

/**
 * @returns {{sources: Array, consumes: Array}}
 */
export function tf2RollSources(actor, target, ctx = {}) {
  const { item, rolledSkill, isAttack } = ctx;
  // dice.mjs doesn't hand the dataset to roll sources, so the pre-roll hook keeps what it needs.
  const dataset = ctx.dataset ?? lastRoll.get(actor?.uuid) ?? {};
  const sources = [];
  const consumes = [];

  // Broad Understanding: "Skill Tests outside your Specialization suffer ↓2."
  if (rolledSkill == 'science' && broadUnderstandingApplies(actor)) {
    if (!dataset.isSpecialized && !dataset.specializationKey) {
      sources.push({ id: 'tf2BroadUnderstanding', label: nameOf(actor, TF2.broadUnderstanding, 'Broad Understanding'), shiftDown: 2 });
    }

    if (globalThis.game?.combat && actor.flags?.essence20?.[APPLIED_SCIENCE_FLAG]) {
      consumes.push({ ext: 'tf2AppliedScience', actorUuid: actor.uuid });
    }
  }

  // Cage: a prisoner's escape tests are at ↓2, and Snagged when the captor focused on them.
  for (const mark of marksOf(actor, MARK.caged)) {
    if (['infiltration', 'brawn'].includes(rolledSkill)) {
      sources.push({ id: 'tf2Caged', label: T('Tf2CageEscape', { name: mark.label ?? 'Cage' }), shiftDown: 2 });
      if (mark.focused) {
        sources.push({ id: 'tf2CageFocus', label: T('Tf2CageFocused', { name: mark.label ?? 'Cage' }), snag: true });
        consumes.push({ ext: 'tf2CageFocus', actorUuid: actor.uuid, by: mark.by });
      }
    }
  }

  // Deconstruct: a sabotaged weapon attacks with Snag until repaired.
  const weapon = parentWeaponOf(actor, item);
  if (isAttack && weapon?.flags?.essence20?.[DECONSTRUCTED]) {
    sources.push({ id: 'tf2Deconstructed', label: T('Tf2Deconstructed', { name: weapon.name }), snag: true });
  }

  // Sustained Beam: the second attack is made with Edge.
  const beam = actor?.flags?.essence20?.[SUSTAINED_BEAM_EDGE];
  if (isAttack && beam) {
    sources.push({ id: 'tf2SustainedBeam', label: beam.label ?? 'Sustained Beam', edge: true });
    consumes.push({ ext: 'tf2SustainedBeam', actorUuid: actor.uuid });
  }

  if (target) {
    // Diversion, on the diverted creature: attacking the one who diverted it is Snagged.
    if (isAttack && marksOf(actor, MARK.diversion).some(mark => mark.by == target.uuid)) {
      sources.push({ id: 'tf2DiversionSnag', label: T('Tf2DiversionSnag'), snag: true });
    }

    // Diversion, for the diverter's allies: Edge on attacks against it, unless it went for the diverter.
    const diverted = marksOf(target, MARK.diversion).find(mark => mark.by != actor.uuid && !mark.attackedHolder);
    if (isAttack && diverted && sameSide(actor, diverted.by)) {
      sources.push({ id: 'tf2DiversionEdge', label: T('Tf2DiversionEdge', { name: diverted.label ?? 'Diversion' }), edge: true });
    }

    // Duke It Out, refused: "you gain an Edge on Skill Tests targeting them".
    if (marksOf(target, MARK.dukeRefused).some(mark => mark.by == actor.uuid)) {
      sources.push({ id: 'tf2DukeRefused', label: nameOf(actor, TF2.dukeItOut, 'Duke It Out'), edge: true });
    }
  }

  return { sources, consumes };
}

function dispositionOf(actor) {
  return actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? null;
}

/** Whether the actor is on the same side as the actor behind this uuid. */
export function sameSide(actor, uuid) {
  if (!uuid || actor?.uuid == uuid) {
    return false;
  }

  let other = null;
  try {
    other = typeof fromUuidSync == 'function' ? fromUuidSync(uuid) : null;
  } catch (error) {
    other = null;
  }

  const mine = dispositionOf(actor);
  const theirs = dispositionOf(other);
  return mine != null && theirs != null && mine == theirs;
}

/* -------------------------------------------- */
/*  Dialog switches                              */
/* -------------------------------------------- */

export const TOGGLE = {
  allOut: 'tf2AllOutAttack',
  evasive: 'tf2EvasiveFighting',
};

export function tf2Toggles(actor, { item } = {}) {
  const toggles = [];
  const add = (name, label, type = 'checkbox', extra = {}) => toggles.push({ name, label, type, ...extra });
  const isAttack = item?.type == 'weaponEffect';

  // All Out Attack / Evasive Fighting - "During your turn", on Might, Finesse or Targeting attacks.
  const ownTurn = !globalThis.game?.combat || isOwnTurn(actor);
  if (isAttack && ownTurn && ATTACK_SKILLS.includes(skillOf(item))) {
    if (has(actor, TF2.allOutAttack) && !has(actor, TF2.gijAllOutAttack)) {
      add(TOGGLE.allOut, T('Tf2AllOutAttackToggle', { perk: nameOf(actor, TF2.allOutAttack, 'All Out Attack') }), 'number', { max: 5, value: 0 });
    }

    if (has(actor, TF2.evasiveFighting) && !has(actor, TF2.gijEvasiveFighting)) {
      add(TOGGLE.evasive, T('Tf2EvasiveFightingToggle', { perk: nameOf(actor, TF2.evasiveFighting, 'Evasive Fighting') }), 'number', { max: 5, value: 0 });
    }
  }

  // Bestial Articulation is the Monstrosity Alt Modes' own DialogSwitch rule (rule:altMode).

  return toggles;
}

export async function tf2ApplyDialog(actor, options) {
  const ext = options.ext ?? {};

  const down = n => {
    options.shiftDown = (Number(options.shiftDown) || 0) + n;
  };

  const allOut = Math.max(0, Math.min(5, Number(ext[TOGGLE.allOut]) || 0));
  const evasive = Math.max(0, Math.min(5, Number(ext[TOGGLE.evasive]) || 0));
  if (allOut || evasive) {
    down(allOut + evasive);
    // The extra damage rides on the same field the G.I. JOE printing's own control fills
    // (target-riders.mjs#buildRiderContext reads it into the rider's allOutAttack).
    options.allOutAttackShifts = (Number(options.allOutAttackShifts) || 0) + allOut;
    await setStance(actor, { allOutAttack: allOut, evasiveFighting: evasive });
  }
}

/** target-riders.mjs's riderStance flag, which gives enemies attacking the actor their ↑ / ↓. */
async function setStance(actor, changes) {
  const riders = await import("../../target-riders.mjs");
  const current = riders.stanceOf(actor);
  await actor.setFlag('essence20', 'riderStance', {
    allOutAttack: Math.max(current.allOutAttack, changes.allOutAttack ?? 0),
    evasiveFighting: Math.max(current.evasiveFighting, changes.evasiveFighting ?? 0),
    ...riders.untilStartOfNextTurn(actor),
  });
}

/* -------------------------------------------- */
/*  Arrogant                                     */
/* -------------------------------------------- */

/**
 * Whether an attack right now breaks Arrogant (Enigma of Combination p.25): on your first turn of a
 * combat "you can't attack enemies whose Threat Level is lower than your level, though you can make
 * an area of effect attack that includes such enemies if it also includes at least one enemy whose
 * Threat Level is equal to or higher than your level." Only Threats count - a target with no Threat
 * Level (a character) is never "lower"; a TL 0 one is.
 * @param {Actor} actor
 * @param {Actor[]} targets
 * @param {Object} [options]
 * @param {Boolean} [options.isArea]   The attack is an area of effect.
 * @returns {Boolean}
 */
export function arrogantForbids(actor, targets, { isArea = false } = {}) {
  const combat = globalThis.game?.combat;
  if (!combat || combat.round != 1 || !isOwnTurn(actor) || !has(actor, TF2.arrogant)) {
    return false;
  }

  const level = Number(actor?.system?.level) || 0;
  const tlOf = target => Number(target?.system?.threatLevel);
  const rated = targets.filter(target => target?.system?.threatLevel !== undefined && target?.system?.threatLevel !== null && Number.isFinite(tlOf(target)));
  const lower = rated.filter(target => tlOf(target) < level);
  if (!lower.length) {
    return false;
  }

  return !(isArea && rated.some(target => tlOf(target) >= level));
}

/** What the roll about to be made says about itself, for the roll sources (keyed by actor uuid). */
export const lastRoll = new Map();

export async function tf2PreRoll(actor, dataset, item) {
  if (actor?.uuid) {
    lastRoll.set(actor.uuid, { isSpecialized: !!dataset?.isSpecialized, specializationKey: dataset?.specializationKey ?? null });
  }

  if (item?.type != 'weaponEffect') {
    return;
  }

  // The attack is held, not just flagged: the roll is cancelled with the reason shown.
  const isArea = Number(item.system?.radius) > 0 || !!item.system?.shape;
  if (arrogantForbids(actor, targetedActors(), { isArea })) {
    ui.notifications?.warn?.(T('Tf2ArrogantWarn', { name: nameOf(actor, TF2.arrogant, 'Arrogant') }));
    dataset.cancelRoll = true;
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(tf2RollSources);
registerSpecializes(tf2Specializes);
registerDialogToggles(tf2Toggles);
registerApplyDialog(tf2ApplyDialog);
registerPreRoll(tf2PreRoll);

// Applied Science: the once-per-scene combat use is spent by the Science roll it was for.
registerConsumer('tf2AppliedScience', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor?.flags?.essence20?.[APPLIED_SCIENCE_FLAG]) {
    await actor.unsetFlag('essence20', APPLIED_SCIENCE_FLAG);
  }
});

registerConsumer('tf2SustainedBeam', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  if (actor?.flags?.essence20?.[SUSTAINED_BEAM_EDGE]) {
    await actor.unsetFlag('essence20', SUSTAINED_BEAM_EDGE);
  }
});

// Cage: the captor's focus Snags one escape roll.
registerConsumer('tf2CageFocus', async consume => {
  const actor = await fromUuid(consume.actorUuid);
  const marks = actor?.flags?.essence20?.riderMarks;
  if (!Array.isArray(marks)) {
    return;
  }

  const next = marks.map(mark => (mark?.kind == MARK.caged && mark.by == consume.by ? { ...mark, focused: false } : mark));
  const { writeActor } = await import("./common.mjs");
  await writeActor(actor, 'setFlag', ['essence20', 'riderMarks', next]);
});
