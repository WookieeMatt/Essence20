/**
 * The Scene Clock.
 *
 * Essence20 gates a great many abilities on "once per scene" or "once per encounter", and this
 * codebase has tracked both since long before this file existed - see helpers/perks.mjs, whose
 * hasUsedThisEncounter alone has over a hundred call sites. What it tracked them AGAINST was the
 * problem, and in two different ways:
 *
 * 1. "Once per encounter" was stamped with `game.combat.id`, and both the check and the mark
 *    began `if (!game.combat) return`. Out of combat that reads as "never used", so a
 *    once-per-scene Perk in a roleplay scene was simply unlimited. That is a correctness bug, not
 *    a missing feature, and it is the main reason this module exists.
 *
 * 2. "Once per scene" was stamped with `game.scenes.current.id` - but a Foundry Scene is a MAP,
 *    not a narrative scene. A dungeon on one map is many scenes; a chase across three maps is one.
 *
 * Both are replaced by explicit counters the GM advances, which work identically in and out of
 * combat. Two counters rather than one, because the two windows genuinely differ:
 *
 *   SCENE     advances only when the GM says a new scene has begun.
 *   ENCOUNTER advances with the scene, and also when a combat ends (configurable).
 *
 * Keeping them separate is what lets "once per encounter" behave exactly as it does today - it
 * already refreshed per combat - while "once per scene" stops refreshing at every combat's end.
 *
 * Stale flags written before this existed carry no `epoch`, so they read as "not used in the
 * current epoch" and the ability becomes available once. That is the safe direction to fail.
 */

const SCENE_KEY = 'sceneClockScene';
const ENCOUNTER_KEY = 'sceneClockEncounter';
const LABEL_KEY = 'sceneClockLabel';
const AUTO_KEY = 'sceneClockAdvanceOnCombatEnd';
// MISSION advances when the GM starts a new mission (a G.I. JOE mission, a Power Rangers episode,
// an adventure) - what "once per mission" and a Contact's Allegiance Points refresh on.
const MISSION_KEY = 'sceneClockMission';

/**
 * Read a scene-clock setting without throwing when it isn't registered yet - these are read from
 * prepareDerivedData and sheet rendering, both of which can run before registerSettings().
 * @param {String} key
 * @param {*} fallback
 * @returns {*}
 */
function read(key, fallback) {
  try {
    const value = game?.settings?.get?.('essence20', key);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/**
 * A counter, coerced to a finite number.
 *
 * The coercion is load-bearing rather than defensive dressing: an epoch is compared for equality
 * against what is stored on an actor's flag, so a non-numeric value here would stamp garbage onto
 * every flag written while it persisted, and those flags would then never match anything again.
 * Falling back to 1 keeps the clock usable and merely refreshes abilities once.
 * @param {String} key
 * @returns {Number}
 */
function counter(key) {
  const stored = read(key, 1);
  // null and '' both coerce to a perfectly finite 0, so they have to be rejected before the
  // Number() call rather than after it.
  if (stored === null || stored === undefined || stored === '') {
    return 1;
  }

  const value = Number(stored);
  // Counters only ever increment, and start at 1, so zero or negative is as meaningless as NaN -
  // and a settings store that answers 0 for anything it doesn't know would otherwise silently
  // invalidate every flag written while a real counter was in effect.
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * The current scene counter. Advances only on an explicit "new scene".
 * @returns {Number}
 */
export function getSceneEpoch() {
  return counter(SCENE_KEY);
}

/**
 * The current encounter counter. Advances with the scene, and when a combat ends.
 * @returns {Number}
 */
export function getEncounterEpoch() {
  return counter(ENCOUNTER_KEY);
}

/**
 * The current mission counter. Advances only on an explicit "new mission".
 * @returns {Number}
 */
export function getMissionEpoch() {
  return counter(MISSION_KEY);
}

/**
 * The counter behind a window: 'mission', 'scene' or 'encounter'.
 * @param {String} window
 * @returns {Number}
 */
export function epochFor(window) {
  if (window === 'mission') {
    return getMissionEpoch();
  }

  return window === 'scene' ? getSceneEpoch() : getEncounterEpoch();
}

/**
 * Begin a new mission, which is also a new scene. GM-only.
 * @param {String} [label]
 * @returns {Promise<Number>}   The new mission epoch.
 */
export async function advanceMission(label = '') {
  if (!game.user?.isGM) {
    return getMissionEpoch();
  }

  const next = getMissionEpoch() + 1;
  await game.settings.set('essence20', MISSION_KEY, next);
  await advanceScene(label);
  globalThis.Hooks?.callAll?.('essence20.missionAdvanced', next);
  return next;
}

/**
 * The GM's own name for the current scene, shown in the tracker. Purely a label - nothing gates
 * on it.
 * @returns {String}
 */
export function getSceneLabel() {
  return read(LABEL_KEY, '');
}

/**
 * Whether a combat ending should advance the encounter counter. On by default, which preserves
 * exactly what "once per encounter" did before this module existed (it was keyed on the combat
 * id, so it refreshed for every new combat).
 * @returns {Boolean}
 */
export function advancesOnCombatEnd() {
  return read(AUTO_KEY, true) !== false;
}

/**
 * Begin a new scene: both counters advance, so every "once per scene" and "once per encounter"
 * ability refreshes. GM-only, because these are world settings.
 * @param {String} [label]   An optional name for the new scene.
 * @returns {Promise<Number>}   The new scene epoch.
 */
export async function advanceScene(label = '') {
  if (!game.user?.isGM) {
    return getSceneEpoch();
  }

  const next = getSceneEpoch() + 1;
  await game.settings.set('essence20', SCENE_KEY, next);
  await game.settings.set('essence20', ENCOUNTER_KEY, getEncounterEpoch() + 1);
  await game.settings.set('essence20', LABEL_KEY, label);
  // Per-scene effects that key off a scene ENDING (helpers/environment-hazards.mjs's Irradiated /
  // Harmful-toxicity damage) listen for this rather than being imported here.
  globalThis.Hooks?.callAll?.('essence20.sceneAdvanced', next);
  return next;
}

/**
 * Begin a new encounter without starting a new scene - called when a combat ends, so
 * once-per-encounter abilities refresh while once-per-scene ones do not.
 * @returns {Promise<void>}
 */
export async function advanceEncounter() {
  if (!game.user?.isGM || !advancesOnCombatEnd()) {
    return;
  }

  await game.settings.set('essence20', ENCOUNTER_KEY, getEncounterEpoch() + 1);
}

/**
 * Rename the current scene without advancing anything.
 * @param {String} label
 * @returns {Promise<void>}
 */
export async function setSceneLabel(label) {
  if (game.user?.isGM) {
    await game.settings.set('essence20', LABEL_KEY, label);
  }
}

/**
 * How many times an actor has used an ability in the current window.
 *
 * The single read behind every once-per-scene and once-per-encounter check. A record from an
 * earlier window - or from before the scene clock existed, which has no `epoch` at all - counts
 * as zero.
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {String} [window]   'scene' or 'encounter'.
 * @returns {Number}
 */
export function getUses(actor, flagKey, window = 'encounter') {
  const record = actor?.getFlag?.('essence20', flagKey);
  if (!record) {
    return 0;
  }

  const current = epochFor(window);
  return record.epoch === current ? (record.count ?? 0) : 0;
}

/**
 * Record uses of an ability in the current window. Unlike the combat-stamped helpers this
 * replaces, it works out of combat - which is the whole point.
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {Object} [options]
 * @param {String} [options.window]   'scene' or 'encounter'.
 * @param {Number} [options.count]    How many uses to record at once. Defaults to 1.
 * @returns {Promise<void>}
 */
export async function markUsed(actor, flagKey, { window = 'encounter', count = 1 } = {}) {
  const epoch = epochFor(window);
  await actor.setFlag('essence20', flagKey, {
    epoch,
    window,
    count: getUses(actor, flagKey, window) + count,
  });
}

/**
 * Whether a "for the rest of this scene/encounter" duration flag - one set with activateForWindow
 * below - is still in effect.
 *
 * Reuses getUses's own epoch bookkeeping rather than inventing a second storage shape: a flag set
 * for the current window reads as "used" (count 1) until the window it was stamped with no longer
 * matches, at which point getUses already reads it as zero. That is precisely "expired" for a
 * duration flag, so nothing here has to sweep or delete anything - the many "1 scene"/"1 day"
 * spell and Perk flags across this codebase that used to say "no active expiry hook, left set
 * until manually cleared" (Fluttery Wings, Lightning Speed, Hot To Trot, and their siblings) can
 * all resolve their duration through this one check instead.
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {String} [window]   'scene' or 'encounter'.
 * @returns {Boolean}
 */
export function isActiveForWindow(actor, flagKey, window = 'scene') {
  return getUses(actor, flagKey, window) > 0;
}

/**
 * Turns on a duration flag for the rest of the current scene/encounter window. See
 * isActiveForWindow above. Idempotent within the same window - recasting the same buff before it
 * expires doesn't stack a count, it just keeps it active.
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {String} [window]   'scene' or 'encounter'.
 * @returns {Promise<void>}
 */
export async function activateForWindow(actor, flagKey, window = 'scene') {
  const epoch = epochFor(window);
  await actor.setFlag('essence20', flagKey, { epoch, window, count: 1 });
}

/**
 * Turns on a duration flag that lasts a number of combat rounds ("10 rounds", "1 minute" - ten
 * 6-second rounds). Stored in the same shape activateForWindow writes, stamped with the encounter
 * epoch, plus - when a Combat is running - which Combat and the round/turn it runs out on.
 *
 * In a Combat it ends on the caster's own turn `rounds` rounds later, or when that Combat ends.
 * Out of Combat there are no rounds to count, so it falls back to the rest of the encounter
 * (which also ends with the scene) - never "forever".
 * @param {Actor} actor
 * @param {String} flagKey
 * @param {Number} rounds
 * @returns {Promise<void>}
 */
export async function activateForRounds(actor, flagKey, rounds) {
  const record = { epoch: getEncounterEpoch(), window: 'encounter', count: 1 };
  const combat = globalThis.game?.combat;
  if (combat?.id && rounds > 0) {
    record.combatId = combat.id;
    record.untilRound = Math.max(Number(combat.round) || 0, 1) + rounds;
    record.untilTurn = Number(combat.turn) || 0;
  }

  await actor.setFlag('essence20', flagKey, record);
}

/**
 * Whether a flag set with activateForRounds is still running.
 * @param {Actor} actor
 * @param {String} flagKey
 * @returns {Boolean}
 */
export function isActiveForRounds(actor, flagKey) {
  if (!isActiveForWindow(actor, flagKey, 'encounter')) {
    return false;
  }

  const record = actor.getFlag('essence20', flagKey);
  if (!record.combatId) {
    return true;
  }

  // The Combat it was counting rounds in has ended (or isn't this world's any more).
  const combats = globalThis.game?.combats;
  const combat = combats?.get?.(record.combatId)
    ?? (globalThis.game?.combat?.id == record.combatId ? globalThis.game.combat : null);
  if (!combat) {
    return false;
  }

  const round = Number(combat.round) || 0;
  const turn = Number(combat.turn) || 0;
  return round < record.untilRound || (round == record.untilRound && turn < record.untilTurn);
}
