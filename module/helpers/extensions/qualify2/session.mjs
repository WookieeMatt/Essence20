import { getEncounterEpoch } from "../../scene-clock.mjs";
import { worldActors } from "../../companion-link.mjs";

/**
 * Game sessions (qualify2 slice).
 *
 * A session begins when the GM presses New Session in the Story Points app (apps/story-points.mjs),
 * which resets the primary Party's pools with exactly {system.storyPoints, system.gmPoints}
 * (helpers/story-points.mjs#sessionResetUpdate). That write is recognised here and counted in a
 * world setting (essence20.q2SessionEpoch).
 *
 * "Once per session" Perks whose existing code gates them once per encounter (the helpers/perks.mjs
 * markUsedThisEncounter record, epoch-stamped by helpers/scene-clock.mjs) keep reading as used for the
 * rest of the session: when a gated record is written its session is noted, and each time the
 * encounter counter advances the active GM re-stamps the records used this session onto the new
 * encounter. A new session clears them all. ("A" for Effort! and Real Angels are their items' own
 * rules now, with a per-session limit; so is Timeline Anomaly's Initiative swap.) No Perk is gated this way at the
 * moment - SESSION_GATED is where one would go.
 *
 * Bumping the counter is what fires item rules' `sessionStart` Triggers (rules/triggers.mjs) -
 * Everything is Inspiration's Story Point and Nobility's one fewer are rules on their items now.
 */

const SETTING = 'q2SessionEpoch';
const USES_FLAG = 'q2SessionUses';

export const SESSION_GATED = {};

export function getSessionEpoch() {
  try {
    const value = Number(game.settings.get('essence20', SETTING));
    return Number.isFinite(value) && value > 0 ? value : 1;
  } catch (error) {
    return 1;
  }
}

export function registerSessionSetting() {
  game.settings.register('essence20', SETTING, { scope: 'world', config: false, type: Number, default: 1 });
}

/** Whether this Party update is the New Session reset: exactly the two pool keys. */
export function isSessionReset(actor, changes) {
  if (actor?.type != 'party') {
    return false;
  }

  const keys = Object.keys(foundry.utils.flattenObject(changes ?? {})).filter(key => key != '_id');
  return keys.length == 2 && keys.includes('system.storyPoints') && keys.includes('system.gmPoints');
}

/** A gated record was written by this client: note the session it belongs to. */
export async function noteGatedUse(actor, changes, options, userId) {
  const written = changes?.flags?.essence20 ?? {};
  const keys = Object.keys(SESSION_GATED).filter(key => written[key] && typeof written[key] == 'object');
  if (!keys.length || userId != game.user?.id) {
    return;
  }

  const session = getSessionEpoch();
  const uses = actor.getFlag('essence20', USES_FLAG) ?? {};
  if (keys.every(key => uses[key] === session)) {
    return;
  }

  await actor.setFlag('essence20', USES_FLAG, { ...uses, ...Object.fromEntries(keys.map(key => [key, session])) });
}

/** The encounter moved on: records used this session stay used (active GM). */
export async function carryGatedUses(epoch = getEncounterEpoch()) {
  if (!game.user?.isActiveGM) {
    return;
  }

  const session = getSessionEpoch();
  for (const actor of worldActors()) {
    const uses = actor.getFlag?.('essence20', USES_FLAG) ?? {};
    for (const [key, used] of Object.entries(uses)) {
      const record = actor.getFlag('essence20', key);
      if (used === session && SESSION_GATED[key] && record?.epoch !== epoch) {
        await actor.setFlag('essence20', key, { epoch, window: 'encounter', count: Math.max(1, record?.count ?? 1) });
      }
    }
  }
}

/** A new session: bump the counter (firing sessionStart Triggers) and free the gated Perks. */
export async function startNewSession() {
  if (!game.user?.isGM) {
    return;
  }

  await game.settings.set('essence20', SETTING, getSessionEpoch() + 1);
  for (const actor of worldActors()) {
    if (actor.getFlag?.('essence20', USES_FLAG)) {
      for (const key of Object.keys(actor.getFlag('essence20', USES_FLAG))) {
        if (actor.getFlag('essence20', key)) {
          await actor.unsetFlag('essence20', key);
        }
      }

      await actor.unsetFlag('essence20', USES_FLAG);
    }
  }
}

let pendingReset = null;

export function onPreUpdateActor(actor, changes) {
  if (game.user?.isGM && isSessionReset(actor, changes)) {
    pendingReset = actor.id;
  }
}

export async function onUpdateActor(actor, changes, options, userId) {
  if (pendingReset && actor?.id == pendingReset && userId == game.user?.id) {
    pendingReset = null;
    await startNewSession();
    return;
  }

  await noteGatedUse(actor, changes, options, userId);
}

export function onUpdateSetting(setting) {
  if (setting?.key == 'essence20.sceneClockEncounter') {
    carryGatedUses(Number(setting.value) || getEncounterEpoch());
  }
}

if (globalThis.Hooks?.on) {
  Hooks.once('init', registerSessionSetting);
  Hooks.on('preUpdateActor', onPreUpdateActor);
  Hooks.on('updateActor', onUpdateActor);
  Hooks.on('updateSetting', onUpdateSetting);
}
