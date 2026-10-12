/**
 * Rosters (`system.actors`: a vehicle's or Zord's crew, a Ranger's Zords, a Megaform's members, a Party) list actors by
 * uuid. Deleting one of those actors - or the unlinked token a copy lived in - never took it off the rosters listing
 * it, so its card stayed behind, empty: no name, no Health, still in the driver's seat.
 *
 *  - When an actor or an unlinked token is deleted, the active GM takes it off every roster that lists it.
 *  - On load, the active GM takes any entry whose actor is already gone off its roster (left from before this).
 *
 * Only entries naming a world actor ("Actor.<id>") or a scene token's actor ("Scene.<id>.Token.<id>.Actor.<id>") are
 * judged: anything else (a compendium uuid) is left as it is.
 */
import { rosterRemovalUpdate } from "../../util/roster.mjs";

/** Whether an entry's uuid names a world actor or a token's actor - the kinds this can tell are gone. */
export function isLocalActorUuid(uuid) {
  return /^Actor\.[A-Za-z0-9]+$/.test(uuid ?? '') || /^Scene\.[A-Za-z0-9]+\.Token\.[A-Za-z0-9]+\.Actor\.[A-Za-z0-9]+$/.test(uuid ?? '');
}

/**
 * The roster keys of an actor whose entry names a gone actor. Exported for tests.
 * @param {Object} actor
 * @param {Function} isGone   uuid -> whether that actor no longer exists
 * @returns {String[]}
 */
export function goneKeys(actor, isGone) {
  return Object.entries(actor?.system?.actors ?? {})
    .filter(([, entry]) => entry && isLocalActorUuid(entry.uuid) && isGone(entry.uuid))
    .map(([key]) => key);
}

/** Every actor that can hold a roster: the world's, and each unlinked token's own copy. */
function rosterHolders() {
  const tokenActors = (globalThis.game?.scenes?.contents ?? [])
    .flatMap(scene => scene.tokens.contents.filter(token => !token.actorLink && token.actor).map(token => token.actor));
  return [...(globalThis.game?.actors?.contents ?? []), ...tokenActors];
}

/** Take the given roster keys off an actor. */
async function removeKeys(actor, keys) {
  if (!keys.length) {
    return;
  }

  await actor.update(rosterRemovalUpdate(actor, keys));
}

/**
 * Take these actors (by uuid) off every roster.
 * @param {Set<String>} uuids
 */
export async function removeFromRosters(uuids) {
  for (const holder of rosterHolders()) {
    await removeKeys(holder, goneKeys(holder, uuid => uuids.has(uuid)));
  }
}

/** On load: every entry whose actor is already gone comes off its roster. Returns how many. */
export async function cleanGoneRosterEntries() {
  let removed = 0;
  for (const holder of rosterHolders()) {
    const keys = goneKeys(holder, uuid => !globalThis.fromUuidSync?.(uuid, { strict: false }));
    removed += keys.length;
    await removeKeys(holder, keys);
  }

  if (removed) {
    console.log(`Essence20 | Took ${removed} deleted actors off the rosters that still listed them.`);
  }

  return removed;
}

if (typeof Hooks != 'undefined') {
  const isActiveGm = () => !!globalThis.game?.users?.activeGM?.isSelf;

  Hooks.on('deleteActor', async actor => {
    if (isActiveGm()) {
      await removeFromRosters(new Set([actor.uuid]));
    }
  });

  // An unlinked token's copy lives in the token: deleting the token deletes the actor a roster may name.
  Hooks.on('deleteToken', async token => {
    if (isActiveGm() && !token.actorLink && token.actorId) {
      await removeFromRosters(new Set([`${token.uuid}.Actor.${token.actorId}`]));
    }
  });

  Hooks.once('ready', async () => {
    if (isActiveGm()) {
      try {
        await cleanGoneRosterEntries();
      } catch (error) {
        console.error("Essence20 | Cleaning up rosters failed", error);
      }
    }
  });
}
