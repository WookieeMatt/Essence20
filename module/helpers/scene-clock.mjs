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

  const current = window === 'scene' ? getSceneEpoch() : getEncounterEpoch();
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
  const epoch = window === 'scene' ? getSceneEpoch() : getEncounterEpoch();
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
  const epoch = window === 'scene' ? getSceneEpoch() : getEncounterEpoch();
  await actor.setFlag('essence20', flagKey, { epoch, window, count: 1 });
}
