import { rulesOfType } from "../../rules/index.mjs";
import { contextFor, evaluate, isStatic } from "../../rules/predicate.mjs";
import { resolveValue } from "../../rules/formula.mjs";
import { registerPreRoll, registerRollSources } from "../item-hooks.mjs";
import { announce } from "../world/public-hooks.mjs";
import { worldActors } from "../companions/companion-link.mjs";

/**
 * Riding in a Transformer's Alt Mode (TF CRB p.47, Alt Mode Statistics): an Alt Mode's Crew is how many Common
 * creatures fit inside; one passenger may be the Driver, who only Lends Assistance on Driving Skill Tests (if they have
 * ranks in it) - the Transformer still drives itself, keeps its own Initiative and moves on its own. Embarked Crew may
 * use the Integrated Hardpoint weapons, and fire their own weapons from a Firepoint (with a Snag, p.165 Attacking From
 * A Vehicle). No Crew in Bot Mode unless something says so (Extra Crew Capacity), and converting into Bot Mode puts
 * everyone out at once. A Cybertronian in its Alt Mode never counts as Crew.
 *
 * Kept apart from a vehicle's or Zord's system.actors crew on purpose: every reader of that one treats its driver as
 * the one driving (the vehicle's Initiative, movement, Ram). Here it's flags.essence20.altModeCrew on the Transformer:
 * {<key>: {uuid, name, img, role: driver | passenger | prisoner, firepoint, at}}.
 *
 * - Boarding (board): within Reach of the Transformer's token (when both are on the map), Common or smaller, not
 *   already aboard, room left. Embarking a Transformer that has moved this turn is the p.165 Athletics / Acrobatics /
 *   Driving test, DIF 5 + feet moved / 5; otherwise it's half the passenger's Movement - said in chat, as Zord
 *   disembarking says its 15 ft.
 * - Prisoners (Cage, TF CRB p.134): role prisoner, only with a Cage rule; up to the Crew rating in Alt Mode, one in Bot
 *   Mode. The Cage's ↓2 / Snag ride on its caged / cageFocus marks; escape (escape) rolls Infiltration against the
 *   captor's Cleverness or Brawn against its Toughness, and a prisoner can't simply get out otherwise.
 * - Tokens (the active GM, syncCrewTokens): a passenger's token is hidden and rides along on top of the Transformer's;
 *   getting out unhides it beside it.
 * - Crashing (crash, p.163): DIF 13 Athletics or Acrobatics to leap free (Prone, 1d2 Blunt); those still inside take
 *   half the impact damage.
 *
 * Rule types (rules/plugins/zords/alt-mode-crew-rules.mjs): CrewCapacity {add?, set?, modes?} and Cage; the passengers
 * link scope (rules on the Transformer's items reaching whoever rides in it).
 */

export const CREW_FLAG = 'altModeCrew';
export const RIDING_FLAG = 'ridingIn';
export const CREW_ROLES = ['driver', 'passenger', 'prisoner'];
/** Crew are "Common creatures" (TF CRB p.47). */
const CREW_SIZES = ['small', 'common'];
const CRASH_LEAP_DIF = 13;

const T = (key, data) => {
  const i18n = globalThis.game?.i18n;
  const full = `E20.AltCrew${key}`;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : `${key}${data ? ` ${JSON.stringify(data)}` : ''}`;
};

const sameActor = (a, b) => !!a && !!b && (a === b || (!!a.uuid && a.uuid == b.uuid));

function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
}

/** A Transformer: the one kind of actor with an Alt Mode to ride in. */
export const isTransformer = actor => !!actor?.system?.canTransform;

/** The Alt Mode it's in now, or null in Bot Mode. */
export function activeAltMode(actor) {
  if (!actor?.system?.isTransformed) {
    return null;
  }

  return actor.items?.get?.(actor.system.altModeId) ?? [...(actor.items ?? [])].find(item => item?.id == actor.system.altModeId) ?? null;
}

const modeOf = actor => (actor?.system?.isTransformed ? 'alt' : 'bot');

function liveRules(actor, type, mode) {
  return rulesOfType(actor, type).filter(({ rule, item }) => [mode, 'both'].includes(rule.modes ?? 'alt')
    && isStatic(rule.when) && evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
}

/** The Crew rating it has in its current Mode: the Alt Mode's own, then CrewCapacity rules (set, then add). */
export function crewCapacity(actor) {
  if (!isTransformer(actor)) {
    return 0;
  }

  const mode = modeOf(actor);
  let capacity = mode == 'alt' ? Math.max(0, Number(activeAltMode(actor)?.system?.altModeCrew) || 0) : 0;
  const live = liveRules(actor, 'CrewCapacity', mode);
  for (const { rule, item } of live) {
    if (rule.set !== undefined) {
      capacity = resolveValue(rule.set, { actor, item }, capacity);
    }
  }

  for (const { rule, item } of live) {
    if (rule.add !== undefined) {
      capacity += resolveValue(rule.add, { actor, item }, 0);
    }
  }

  return Math.max(0, Math.round(Number(capacity) || 0));
}

/** Its Firepoints: the Alt Mode's own (none in Bot Mode). */
export const firepointCapacity = actor => Math.max(0, Number(activeAltMode(actor)?.system?.altModeFirepoints) || 0);

/** Whether it can hold prisoners (a Cage rule). */
export const canImprison = actor => isTransformer(actor) && rulesOfType(actor, 'Cage').length > 0;

/** How many prisoners it can hold now: up to its Crew rating in Alt Mode, one in Bot Mode (Cage, TF CRB p.134). */
export function prisonerLimit(actor) {
  if (!canImprison(actor)) {
    return 0;
  }

  return actor.system.isTransformed ? crewCapacity(actor) : 1;
}

/** Its crew rows, oldest aboard first: [{key, uuid, name, img, role, firepoint, at}]. */
export function crewEntries(actor) {
  return Object.entries(actor?.flags?.essence20?.[CREW_FLAG] ?? {}).filter(([, entry]) => entry?.uuid)
    .map(([key, entry]) => ({ key, role: 'passenger', ...entry }))
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
}

/** Its crew, resolved: [{key, entry, actor}] (anyone who no longer exists is left out). */
export function crewOf(actor) {
  return crewEntries(actor).map(entry => ({ key: entry.key, entry, actor: resolve(entry.uuid) })).filter(row => row.actor);
}

/** Its Driver, or null. */
export const driverOf = actor => crewOf(actor).find(row => row.entry.role == 'driver')?.actor ?? null;

/** This actor's seat in the Transformer, or null. */
export function seatOf(carrier, actor) {
  return crewEntries(carrier).find(entry => entry.uuid == actor?.uuid) ?? null;
}

/** Every Transformer that might be carrying someone: world actors, and unlinked tokens' own actors on the canvas. */
function candidates() {
  const list = worldActors().filter(isTransformer);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    const actor = token?.document?.actorLink === false ? token.actor : null;
    if (isTransformer(actor) && !list.includes(actor)) {
      list.push(actor);
    }
  }

  return list;
}

/** The Transformer this actor rides in, and their seat - or null. */
export function carrierOf(actor, actors = candidates()) {
  if (!actor?.uuid) {
    return null;
  }

  for (const carrier of actors) {
    const entry = seatOf(carrier, actor);
    if (entry && !sameActor(carrier, actor)) {
      return { carrier, entry, key: entry.key };
    }
  }

  return null;
}

/** An actor's token on a scene (the viewed one by default), or null. */
export function tokenOf(actor, scene = globalThis.canvas?.scene) {
  if (!actor || !scene) {
    return null;
  }

  if (actor.isToken) {
    return actor.token?.parent == scene ? actor.token : null;
  }

  return [...(scene.tokens ?? [])].find(token => token.actorLink && token.actorId == actor.id)
    ?? (actor.getActiveTokens?.(false, true) ?? []).find(token => token.parent == scene) ?? null;
}

/** The scenes a Transformer's crew has tokens to keep in line on: its own token's, and any with a rider of it. */
function scenesOf(carrier) {
  if (carrier?.isToken) {
    return carrier.token?.parent ? [carrier.token.parent] : [];
  }

  const scenes = [...(globalThis.game?.scenes ?? [])].filter(scene => tokenOf(carrier, scene)
    || [...(scene.tokens ?? [])].some(token => token.flags?.essence20?.[RIDING_FLAG] == carrier?.uuid));
  const viewed = globalThis.canvas?.scene;
  return viewed && !scenes.includes(viewed) && tokenOf(carrier, viewed) ? [...scenes, viewed] : scenes;
}

/** Whether the actor is in the running fight (a combat with no combatant list - a test's - counts everyone). */
function inFight(actor) {
  const combat = globalThis.game?.combat;
  if (!combat?.started) {
    return false;
  }

  const combatants = combat.combatants;
  if (!combatants) {
    return true;
  }

  return [...combatants].some(combatant => combatant.actor === actor || (actor?.uuid && combatant.actor?.uuid == actor.uuid));
}

/**
 * Whether two tokens touch (edge to edge, diagonals included) - from their documents' stored place and size, so a token
 * still animating to a new size (a Transformer that just converted) counts at the size it's becoming. Exported for tests.
 */
export function tokensAdjacent(a, b, size = 100) {
  const box = token => {
    const source = token._source ?? token;
    const w = (Number(source.width) || 1) * size;
    const h = (Number(source.height) || 1) * size;
    return { x: Number(source.x) || 0, y: Number(source.y) || 0, w, h };
  };

  const [p, q] = [box(a), box(b)];
  const gapX = Math.max(0, Math.max(p.x, q.x) - Math.min(p.x + p.w, q.x + q.w));
  const gapY = Math.max(0, Math.max(p.y, q.y) - Math.min(p.y + p.h, q.y + q.h));
  return Math.max(gapX, gapY) < size / 2;
}

/**
 * Why this actor can't board the Transformer in that role, as a lang key (E20.AltCrew<key>), or null when they can.
 * `crew`: the seats to count (setSeat leaves out the one changing), and then whoever it is is already aboard.
 * Exported for tests.
 */
export function boardRefusal(carrier, passenger, role = 'passenger', { crew = null } = {}) {
  if (!isTransformer(carrier)) {
    return 'NotTransformer';
  }

  if (!passenger || sameActor(carrier, passenger)) {
    return 'NoPassenger';
  }

  if (!CREW_ROLES.includes(role)) {
    return 'BadRole';
  }

  const aboard = crew ? null : carrierOf(passenger);
  if (aboard) {
    return sameActor(aboard.carrier, carrier) ? 'AlreadyAboard' : 'AboardOther';
  }

  if (isTransformer(passenger) && passenger.system.isTransformed) {
    return 'NoAltModes';
  }

  if (!CREW_SIZES.includes(passenger.system?.size ?? 'common')) {
    return 'TooBig';
  }

  const transformed = !!carrier.system.isTransformed;
  crew ??= crewEntries(carrier);
  if (role == 'prisoner') {
    if (!canImprison(carrier)) {
      return 'NoCage';
    }

    if (crew.filter(entry => entry.role == 'prisoner').length >= prisonerLimit(carrier)) {
      return 'CageFull';
    }

    // Bot Mode's one prisoner is the Cage's own, apart from any Crew rating.
    if (!transformed) {
      return null;
    }
  } else if (role == 'driver') {
    if (!transformed) {
      return 'DriverAltOnly';
    }

    if (crew.some(entry => entry.role == 'driver')) {
      return 'DriverTaken';
    }
  }

  const capacity = crewCapacity(carrier);
  if (!transformed && !capacity) {
    return 'BotMode';
  }

  const counted = transformed ? crew.length : crew.filter(entry => entry.role != 'prisoner').length;
  return counted >= capacity ? 'Full' : null;
}

/* -------------------------------------------- */
/*  Writing the crew                             */
/* -------------------------------------------- */

/**
 * Sets or clears one seat - on the Transformer itself when this user may, through the GM otherwise (a passenger
 * climbing into a friend).
 */
async function writeSeat(carrier, key, entry, { escaped = false, passengerUuid = null } = {}) {
  const user = globalThis.game?.user;
  if (user?.isGM || carrier.isOwner) {
    const value = entry ?? new foundry.data.operators.ForcedDeletion();
    await carrier.update({ [`flags.essence20.${CREW_FLAG}.${key}`]: value });
    return true;
  }

  const { createViaGm } = await import("../world/gm-relay.mjs");
  return !!(await createViaGm('altModeCrew', { actorUuid: carrier.uuid, passengerUuid: passengerUuid ?? entry?.uuid, key, entry, escaped }));
}

/**
 * The GM's side of a relayed seat change: allowed for whoever owns the Transformer or the passenger - except that a
 * prisoner's own player only gets them out by escaping. Exported for gm-relay.mjs.
 */
export function relayedSeatAllowed(payload, user) {
  const carrier = resolve(payload?.actorUuid);
  const passenger = resolve(payload?.passengerUuid);
  if (!isTransformer(carrier) || !passenger || !user) {
    return false;
  }

  const owns = doc => !!doc && (user.isGM || !!doc.testUserPermission?.(user, 'OWNER'));
  if (owns(carrier)) {
    return true;
  }

  if (!owns(passenger)) {
    return false;
  }

  if (payload.entry) {
    return payload.entry.uuid == passenger.uuid && payload.entry.role != 'prisoner';
  }

  return seatOf(carrier, passenger)?.role != 'prisoner' || !!payload.escaped;
}

/** Carries out a relayed seat change (the GM). */
export async function applyRelayedSeat(payload) {
  const carrier = resolve(payload.actorUuid);
  const value = payload.entry ?? new foundry.data.operators.ForcedDeletion();
  await carrier.update({ [`flags.essence20.${CREW_FLAG}.${payload.key}`]: value });
  return true;
}

const newKey = carrier => {
  const taken = carrier?.flags?.essence20?.[CREW_FLAG] ?? {};
  let key;
  do {
    key = globalThis.foundry?.utils?.randomID?.(8) ?? Math.random().toString(36).slice(2, 10);
  } while (taken[key]);

  return key;
};

/** The best of a passenger's Athletics, Acrobatics and Driving (by ranks) - for getting in or out of a moving one. */
async function bestMovingSkill(actor) {
  const { getSkillRanks } = await import("../combat/combat.mjs");
  const skills = ['athletics', 'acrobatics', 'driving'].filter(skill => actor.system?.skills?.[skill]);
  return skills.sort((a, b) => getSkillRanks(actor, b) - getSkillRanks(actor, a))[0] ?? 'athletics';
}

/**
 * Getting in or out of a Transformer that has moved this turn (TF CRB p.165): DIF 5 + feet moved / 5. True when it
 * hasn't moved (or there's no fight), else the roll's result.
 */
async function movingTest(carrier, actor) {
  if (!inFight(carrier)) {
    return true;
  }

  const { feetMovedThisTurn } = await import("../../items/vehicles/armored-cabin.mjs");
  const feet = feetMovedThisTurn(carrier) ?? 0;
  if (feet <= 0 || !actor?._dice?.rollSkill) {
    return true;
  }

  const skill = await bestMovingSkill(actor);
  const dif = 5 + Math.floor(feet / 5);
  const essence = globalThis.CONFIG?.E20?.skillToEssence?.[skill] ?? 'speed';
  const result = await actor._dice.rollSkill({ skill, essence, dif: String(dif), shiftUp: 0, shiftDown: 0 }, actor);
  return !!result?.success;
}

const say = (actor, text) => globalThis.ChatMessage?.create?.({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${text}</p>` });

const roleLabel = role => T(`Role${role[0].toUpperCase()}${role.slice(1)}`);

/**
 * Climb into the Transformer's Alt Mode (or be put in its Cage).
 * @param {Actor} carrier
 * @param {Actor} passenger
 * @param {Object} [options]
 * @param {String} [options.role]   driver, passenger or prisoner
 * @param {Boolean} [options.force]   Skip the Reach and moving checks (the GM's call, a Cage's Use).
 * @returns {Promise<Boolean>}
 */
export async function board(carrier, passenger, { role = 'passenger', force = false } = {}) {
  const refusal = boardRefusal(carrier, passenger, role);
  if (refusal) {
    globalThis.ui?.notifications?.warn?.(T(refusal, { name: passenger?.name ?? '', carrier: carrier?.name ?? '' }));
    return false;
  }

  if (!force) {
    // On a scene where both have a token (the GM's call otherwise).
    const scene = scenesOf(carrier).find(other => tokenOf(passenger, other)) ?? null;
    const carrierToken = scene ? tokenOf(carrier, scene) : null;
    const passengerToken = scene ? tokenOf(passenger, scene) : null;
    if (carrierToken && passengerToken) {
      if (!tokensAdjacent(carrierToken, passengerToken, carrierToken.parent?.grid?.size ?? 100)) {
        globalThis.ui?.notifications?.warn?.(T('NotInReach', { name: passenger.name, carrier: carrier.name }));
        return false;
      }
    }

    if (role != 'prisoner' && !(await movingTest(carrier, passenger))) {
      await say(passenger, T('BoardFailed', { name: passenger.name, carrier: carrier.name }));
      return false;
    }
  }

  const used = crewEntries(carrier).filter(entry => entry.firepoint).length;
  const key = newKey(carrier);
  const entry = {
    uuid: passenger.uuid, name: passenger.name, img: passenger.img ?? null, role,
    firepoint: role != 'prisoner' && used < firepointCapacity(carrier), at: Date.now(),
  };
  if (!(await writeSeat(carrier, key, entry))) {
    return false;
  }

  // A prisoner carries the Cage's mark, which its ↓2 and Snag ride on (the Cage's own rules).
  if (role == 'prisoner' && !passenger.flags?.essence20?.ruleMarks?.caged) {
    const { write } = await import("../../rules/plugins/shared/zord-crew-lookups.mjs");
    await write(passenger, 'update', [{ 'flags.essence20.ruleMarks.caged': { by: carrier.uuid, until: null, stamp: null } }]);
  }

  const fighting = inFight(passenger) && role != 'prisoner';
  await say(passenger, T(role == 'prisoner' ? 'Imprisoned' : 'Boarded', { name: passenger.name, carrier: carrier.name, role: roleLabel(role) })
    + (fighting ? ` ${T('BoardMovement')}` : ''));
  announce('altModeBoarded', { carrier, passenger, role });
  return true;
}

/**
 * Get out of the Transformer.
 * @param {Actor} carrier
 * @param {Actor} passenger
 * @param {Object} [options]
 * @param {Boolean} [options.force]   No checks (converting to Bot Mode, a crash, the captor letting a prisoner go).
 * @param {Boolean} [options.escaped]   A prisoner who broke out (escape).
 * @param {Boolean} [options.quiet]   No chat line of its own.
 * @returns {Promise<Boolean>}
 */
export async function disembark(carrier, passenger, { force = false, escaped = false, quiet = false } = {}) {
  const seat = seatOf(carrier, passenger);
  if (!seat) {
    globalThis.ui?.notifications?.warn?.(T('NotAboard', { name: passenger?.name ?? '', carrier: carrier?.name ?? '' }));
    return false;
  }

  const captor = globalThis.game?.user?.isGM || carrier.isOwner;
  if (seat.role == 'prisoner' && !force && !escaped && !captor) {
    globalThis.ui?.notifications?.warn?.(T('MustEscape', { name: passenger.name, carrier: carrier.name }));
    return false;
  }

  if (!force && !escaped && !(await movingTest(carrier, passenger))) {
    await say(passenger, T('DisembarkFailed', { name: passenger.name, carrier: carrier.name }));
    return false;
  }

  if (!(await writeSeat(carrier, seat.key, null, { escaped, passengerUuid: passenger.uuid }))) {
    return false;
  }

  if (seat.role == 'prisoner') {
    await clearCageMarks(passenger);
  }

  if (!quiet) {
    await say(passenger, T(escaped ? 'Escaped' : 'Disembarked', { name: passenger.name, carrier: carrier.name }));
  }

  announce('altModeDisembarked', { carrier, passenger, role: seat.role, escaped });
  return true;
}

async function clearCageMarks(passenger) {
  const marks = passenger?.flags?.essence20?.ruleMarks ?? {};
  const keys = ['caged', 'cageFocus'].filter(key => marks[key]);
  if (!keys.length) {
    return;
  }

  const { write } = await import("../../rules/plugins/shared/zord-crew-lookups.mjs");
  await write(passenger, 'update', [Object.fromEntries(keys.map(key => [`flags.essence20.ruleMarks.${key}`, new foundry.data.operators.ForcedDeletion()]))]);
}

/** Change a crew member's role (driver, passenger, prisoner) or Firepoint seat. */
export async function setSeat(carrier, key, { role, firepoint } = {}) {
  const entry = crewEntries(carrier).find(row => row.key == key);
  if (!entry) {
    return false;
  }

  const next = { ...entry };
  delete next.key;
  if (role !== undefined && role != entry.role) {
    // The same checks as boarding in that role, with this seat left empty.
    const others = crewEntries(carrier).filter(row => row.key != key);
    const refusal = boardRefusal(carrier, resolve(entry.uuid) ?? { uuid: entry.uuid, system: {} }, role, { crew: others });
    if (refusal) {
      globalThis.ui?.notifications?.warn?.(T(refusal, { name: entry.name, carrier: carrier.name }));
      return false;
    }

    next.role = role;
    if (role == 'prisoner') {
      next.firepoint = false;
    }
  }

  if (firepoint !== undefined) {
    const used = crewEntries(carrier).filter(row => row.firepoint && row.key != key).length;
    if (firepoint && (next.role == 'prisoner' || used >= firepointCapacity(carrier))) {
      globalThis.ui?.notifications?.warn?.(T('NoFirepointLeft', { carrier: carrier.name }));
      return false;
    }

    next.firepoint = !!firepoint;
  }

  return writeSeat(carrier, key, next);
}

/**
 * After a Mode change (transformer-handler.mjs): converting into Bot Mode puts everyone out (TF CRB p.47) - but for
 * the Crew rating its Bot Mode has (Extra Crew Capacity) and the Cage's one prisoner; a smaller Alt Mode keeps only the
 * first aboard. The rest disembark beside it.
 * @param {Actor} carrier
 * @returns {Promise<Array<Actor>>}   Who had to get out.
 */
export async function unloadForMode(carrier) {
  const crew = crewOf(carrier);
  if (!crew.length) {
    return [];
  }

  const leaving = unloadPlan(carrier, crew);
  for (const row of leaving) {
    await disembark(carrier, row.actor, { force: true, quiet: true });
  }

  if (leaving.length) {
    await say(carrier, T('Unloaded', { carrier: carrier.name, names: leaving.map(row => row.actor.name).join(', ') }));
  }

  return leaving.map(row => row.actor);
}

/** Who has to get out after a Mode change - the newest aboard first. Exported for tests. */
export function unloadPlan(carrier, crew = crewOf(carrier)) {
  const transformed = !!carrier.system.isTransformed;
  const capacity = crewCapacity(carrier);
  const prisoners = transformed ? Infinity : prisonerLimit(carrier);
  let room = capacity;
  let cells = prisoners;
  const leaving = [];
  for (const row of crew) {
    const role = row.entry.role;
    if (role == 'prisoner' && !transformed) {
      if (cells > 0) {
        cells--;
        continue;
      }
    } else if (!(role == 'driver' && !transformed) && room > 0) {
      room--;
      continue;
    }

    leaving.push(row);
  }

  return leaving;
}

/**
 * The Transformer crashes in Alt Mode (TF CRB p.163): 1 Blunt per 10 feet it moved that turn; each passenger may leap
 * free with a DIF 13 Athletics or Acrobatics Skill Test (Prone beside it, 1d2 Blunt), and those still inside take half
 * the impact. Its Movement 0 until repaired and its Hardpoint weapons' DIF 14 Might tests are left to the table (said
 * in chat).
 * @param {Actor} carrier
 * @param {Object} [options]
 * @param {Number} [options.feet]   Feet it moved on the turn it crashed.
 */
export async function crash(carrier, { feet = 0 } = {}) {
  if (!carrier?.system?.isTransformed) {
    return false;
  }

  const { applyDamage } = await import("../combat/combat.mjs");
  const { rollBetterOfAthleticsOrAcrobatics } = await import("./vehicle-defeat.mjs");
  const impact = Math.floor((Number(feet) || 0) / 10);
  if (impact > 0) {
    await applyDamage(carrier, impact, 'blunt');
  }

  for (const { actor } of crewOf(carrier)) {
    const { success } = await rollBetterOfAthleticsOrAcrobatics(actor, CRASH_LEAP_DIF);
    if (success) {
      await disembark(carrier, actor, { force: true, quiet: true });
      await actor.toggleStatusEffect?.('prone', { active: true });
      const fall = await new Roll('1d2').evaluate();
      await applyDamage(actor, fall.total, 'blunt');
      await say(actor, T('CrashLeapt', { name: actor.name, carrier: carrier.name }));
    } else if (impact > 0) {
      await applyDamage(actor, Math.ceil(impact / 2), 'blunt');
    }
  }

  await say(carrier, T('Crashed', { carrier: carrier.name, damage: impact }));
  announce('altModeCrashed', { carrier, feet: Number(feet) || 0 });
  return true;
}

/**
 * A prisoner breaks out (Cage, TF CRB p.134): Infiltration against the captor's Cleverness or Brawn against its
 * Toughness - the Cage's ↓2 and its focus Snag come from its own rules. Success gets them out.
 * @param {Actor} prisoner
 * @param {String} [skill]   infiltration or brawn (asked when left out)
 */
export async function escape(prisoner, skill = null) {
  const aboard = carrierOf(prisoner);
  if (aboard?.entry.role != 'prisoner') {
    globalThis.ui?.notifications?.warn?.(T('NotPrisoner', { name: prisoner?.name ?? '' }));
    return false;
  }

  const chosen = skill ?? await askEscapeSkill();
  if (!chosen) {
    return false;
  }

  const defense = chosen == 'brawn' ? 'toughness' : 'cleverness';
  const dif = Number(aboard.carrier.system?.defenses?.[defense]?.total) || 10;
  const essence = globalThis.CONFIG?.E20?.skillToEssence?.[chosen] ?? 'strength';
  const result = await prisoner._dice?.rollSkill?.({ skill: chosen, essence, dif: String(dif), shiftUp: 0, shiftDown: 0 }, prisoner);
  if (!result?.success) {
    return false;
  }

  return disembark(aboard.carrier, prisoner, { escaped: true });
}

async function askEscapeSkill() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    return 'infiltration';
  }

  return DialogV2.wait({
    window: { title: T('EscapeTitle') },
    content: `<p>${T('EscapePrompt')}</p>`,
    buttons: [
      { action: 'infiltration', label: T('EscapeInfiltration'), default: true },
      { action: 'brawn', label: T('EscapeBrawn') },
    ],
    rejectClose: false,
  });
}

/**
 * The Driver Lends Assistance on the Transformer's Driving (TF CRB p.47) - a Standard action in a fight, needing at
 * least one rank of Driving (the usual "as many ranks as the ally" doesn't apply - see the rank bypass below).
 * @param {Actor} driver
 */
export async function assistDriving(driver) {
  const aboard = carrierOf(driver);
  if (aboard?.entry.role != 'driver') {
    globalThis.ui?.notifications?.warn?.(T('NotDriver', { name: driver?.name ?? '' }));
    return false;
  }

  const { getSkillRanks } = await import("../combat/combat.mjs");
  if (getSkillRanks(driver, 'driving') < 1) {
    globalThis.ui?.notifications?.warn?.(T('DriverUntrained', { name: driver.name }));
    return false;
  }

  if (inFight(driver)) {
    const { spend } = await import("../actions/action-economy.mjs");
    const paid = await spend(driver, 'standard', { source: T('AssistDriving'), context: { kind: 'lendAssistance' } });
    if (paid?.blocked) {
      return false;
    }
  }

  const { assistSkill } = await import("../actions/lend-assistance.mjs");
  return assistSkill(driver, aboard.carrier, 'driving');
}

/** The Driver's rank gate (lend-assistance.mjs ASSIST_RANK_BYPASSES): any rank in Driving does. Exported for tests. */
export function driverAssistBypass(actor, ally, skill) {
  if (skill != 'driving') {
    return false;
  }

  const aboard = carrierOf(actor);
  return aboard?.entry.role == 'driver' && sameActor(aboard.carrier, ally);
}

/* -------------------------------------------- */
/*  Rolling from inside                          */
/* -------------------------------------------- */

/** The weapon a weaponEffect hangs off, on its own actor. */
function parentWeapon(item) {
  const owner = item?.parent ?? item?.actor;
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? owner?.items?.get?.(parentId) ?? null : null;
}

/** Whether this weaponEffect belongs to one of the Transformer's equipped Integrated Hardpoint weapons. */
export function isIntegratedAttack(carrier, item) {
  if (item?.type != 'weaponEffect' || !sameActor(item.parent ?? item.actor, carrier)) {
    return false;
  }

  const weapon = parentWeapon(item);
  return weapon?.system?.hardpoint?.type == 'integrated' && weapon.system?.equipped !== false;
}

/**
 * Who may fire the Transformer's Integrated Hardpoint weapon (TF CRB p.47 - "usable by the embarked Crew"): itself,
 * and every crew member who isn't a prisoner. Keys for the roller picker: 'altCrew:<key>'.
 */
export function crewRollerChoices(carrier) {
  return crewEntries(carrier).filter(entry => entry.role != 'prisoner')
    .map(entry => ({ key: `altCrew:${entry.key}`, label: entry.name, uuid: entry.uuid }));
}

/** A crew member's own attack (not the Transformer's weapon): firing from inside. */
function ownAttack(actor, item) {
  return item?.type == 'weaponEffect' && sameActor(item.parent ?? item.actor, actor);
}

// Firing your own weapon from inside needs a Firepoint (TF CRB p.47, p.165) - refused without one; a prisoner fires
// nothing.
registerPreRoll((actor, dataset, item) => {
  if (dataset.cancelRoll || item?.type != 'weaponEffect') {
    return;
  }

  const aboard = carrierOf(actor);
  if (!aboard) {
    return;
  }

  if (aboard.entry.role == 'prisoner') {
    globalThis.ui?.notifications?.warn?.(T('PrisonerCantAttack', { name: actor.name, carrier: aboard.carrier.name }));
    dataset.cancelRoll = true;
  } else if (ownAttack(actor, item) && !aboard.entry.firepoint) {
    globalThis.ui?.notifications?.warn?.(T('NoFirepoint', { name: actor.name, carrier: aboard.carrier.name }));
    dataset.cancelRoll = true;
  }
});

// "Attacking from a vehicle suffers a Snag due to the motion of the vehicle" (TF CRB p.165) - own weapons only; the
// Hardpoint weapons are built to compensate.
registerRollSources((actor, target, ctx) => {
  if (!ctx?.isAttack || !ownAttack(actor, ctx.item)) {
    return null;
  }

  const aboard = carrierOf(actor);
  if (!aboard) {
    return null;
  }

  return { sources: [{ id: 'altModeFirepoint', label: T('FiringFromInside', { carrier: aboard.carrier.name }), snag: true }] };
});

/* -------------------------------------------- */
/*  Tokens (the active GM)                       */
/* -------------------------------------------- */

/** Where a rider's token sits: centred on the Transformer's. Exported for tests. */
export function ridePosition(carrierToken, riderToken, size = 100) {
  const cw = (Number(carrierToken.width) || 1) * size;
  const ch = (Number(carrierToken.height) || 1) * size;
  const rw = (Number(riderToken.width) || 1) * size;
  const rh = (Number(riderToken.height) || 1) * size;
  return { x: Math.round(carrierToken.x + (cw - rw) / 2), y: Math.round(carrierToken.y + (ch - rh) / 2) };
}

const isActiveGm = () => !!globalThis.game?.users?.activeGM?.isSelf;

/**
 * Brings the tokens into line with the crew: a passenger's token is hidden and put on the Transformer's; one whose seat
 * is gone comes back beside it, shown. On the given scene, else every scene the Transformer or a rider of it is on.
 * @param {Actor} carrier
 * @param {Scene} [scene]
 */
export async function syncCrewTokens(carrier, scene = null) {
  if (!isActiveGm() || !carrier) {
    return;
  }

  for (const each of scene ? [scene] : scenesOf(carrier)) {
    await syncSceneTokens(carrier, each);
  }
}

async function syncSceneTokens(carrier, scene) {
  const carrierToken = tokenOf(carrier, scene);
  const size = scene.grid?.size ?? globalThis.canvas?.grid?.size ?? 100;
  const crew = crewOf(carrier);
  const aboard = new Set(crew.map(row => row.actor.uuid));
  const updates = [];
  const movement = {};
  const move = (token, position, extra) => {
    updates.push({ _id: token.id, ...position, ...extra });
    if (position.x !== undefined) {
      Object.assign(movement, teleportMovement(token, position));
    }
  };

  for (const { actor } of crew) {
    const token = tokenOf(actor, scene);
    if (token && carrierToken && token.flags?.essence20?.[RIDING_FLAG] != carrier.uuid) {
      move(token, ridePosition(carrierToken, token, size), { hidden: true, [`flags.essence20.${RIDING_FLAG}`]: carrier.uuid });
    }
  }

  const leaving = [...(scene.tokens ?? [])].filter(token => token.flags?.essence20?.[RIDING_FLAG] == carrier.uuid
    && !aboard.has(token.actor?.uuid));
  if (leaving.length) {
    const { disembarkPositions } = await import("./zord-recall.mjs");
    const positions = carrierToken ? disembarkPositions(carrierToken, leaving.length, size, scene.dimensions?.sceneRect ?? null) : [];
    leaving.forEach((token, i) => move(token, positions[i] ?? {}, { hidden: false, [`flags.essence20.-=${RIDING_FLAG}`]: null }));
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments('Token', updates, { animate: false, movement, essence20AltModeCrew: true });
  }
}

function teleportMovement(token, position) {
  const source = token._source ?? {};
  return {
    [token.id]: { waypoints: [{
      x: position.x, y: position.y, elevation: source.elevation ?? 0, width: source.width ?? 1, height: source.height ?? 1,
      depth: source.depth, shape: source.shape, level: source.level, action: 'displace', snapped: false, explicit: false, checkpoint: true,
    }] },
  };
}

/** The Transformer's token moved: its riders' tokens go with it. */
export async function followCarrier(carrierToken) {
  const carrier = carrierToken?.actor;
  const scene = carrierToken?.parent;
  if (!isActiveGm() || !isTransformer(carrier) || !scene) {
    return;
  }

  const size = scene.grid?.size ?? 100;
  const riders = [...(scene.tokens ?? [])].filter(token => token.flags?.essence20?.[RIDING_FLAG] == carrier.uuid);
  const updates = [];
  const movement = {};
  for (const token of riders) {
    const position = ridePosition(carrierToken, token, size);
    if (position.x != token.x || position.y != token.y) {
      updates.push({ _id: token.id, ...position });
      Object.assign(movement, teleportMovement(token, position));
    }
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments('Token', updates, { animate: false, movement, essence20AltModeCrew: true });
  }
}

if (typeof Hooks != 'undefined') {
  Hooks.on('updateActor', (actor, changes) => {
    const flags = changes?.flags?.essence20 ?? {};
    if (CREW_FLAG in flags || `-=${CREW_FLAG}` in flags) {
      syncCrewTokens(actor);
    }
  });

  Hooks.on('updateToken', (document, changes, options) => {
    // Moved, or resized by a Mode change: its riders stay centred on it.
    if (!options?.essence20AltModeCrew && ['x', 'y', 'width', 'height'].some(key => key in changes)) {
      followCarrier(document);
    }

    // An unlinked Transformer keeps its crew on its token's delta.
    if (changes?.delta?.flags?.essence20 && CREW_FLAG in changes.delta.flags.essence20) {
      syncCrewTokens(document.actor, document.parent);
    }
  });
}

/* -------------------------------------------- */
/*  Sheets                                       */
/* -------------------------------------------- */

/** The Alt Mode tab's Crew panel (templates/actor/parts/misc/alt-mode-crew.hbs), or null for a non-Transformer. */
export function crewSheetContext(actor) {
  if (!isTransformer(actor)) {
    return null;
  }

  const members = crewEntries(actor).map(entry => ({
    ...entry, roleLabel: roleLabel(entry.role), isPrisoner: entry.role == 'prisoner',
    roles: CREW_ROLES.filter(role => role != 'prisoner' || canImprison(actor)).map(role => ({ value: role, label: roleLabel(role), selected: role == entry.role })),
  }));
  return {
    transformed: !!actor.system.isTransformed,
    capacity: crewCapacity(actor),
    firepoints: firepointCapacity(actor),
    firepointsUsed: members.filter(member => member.firepoint).length,
    prisoners: members.filter(member => member.isPrisoner).length,
    prisonerLimit: prisonerLimit(actor),
    canImprison: canImprison(actor),
    members,
    isGM: !!globalThis.game?.user?.isGM,
  };
}

/** The sheet header's "riding in" line for a crew member, or null. */
export function aboardSheetContext(actor) {
  const aboard = carrierOf(actor);
  if (!aboard) {
    return null;
  }

  return {
    carrierName: aboard.carrier.name, carrierUuid: aboard.carrier.uuid, key: aboard.key,
    role: aboard.entry.role, roleLabel: roleLabel(aboard.entry.role), firepoint: !!aboard.entry.firepoint,
    isDriver: aboard.entry.role == 'driver', isPrisoner: aboard.entry.role == 'prisoner',
  };
}

/** Boards every targeted creature (the Crew panel's button) - the GM's or the owner's call, so no Reach check. */
export async function boardTargets(carrier, role = 'passenger') {
  const targets = [...(globalThis.game?.user?.targets ?? [])].map(token => token.actor).filter(actor => actor && !sameActor(actor, carrier));
  if (!targets.length) {
    globalThis.ui?.notifications?.warn?.(T('NoTargets'));
    return 0;
  }

  let count = 0;
  for (const target of targets) {
    count += (await board(carrier, target, { role, force: true })) ? 1 : 0;
  }

  return count;
}
