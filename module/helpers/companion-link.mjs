/**
 * Who a companion belongs to - a pet, drone, Mini-Con, human or alien companion, or a summoned vehicle.
 *
 * The companion carries its owner's uuid in flags.essence20.companionOf, and the owner lists it in
 * system.actors (the same attached-actor collection a PC's Zords and Contacts already use), so it
 * shows on the owner's Contacts tab and opens from there. The flag is the one the rules read: it
 * survives a token copy, and a companion only ever has one owner.
 *
 * Kept free of heavy imports so helpers/action-perks.mjs, dice.mjs and the data models can all ask
 * "whose is this?" without an import loop.
 */

export const COMPANION_FLAG = 'companionOf';

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (!items) {
    return [];
  }

  return Array.isArray(items.contents) ? items.contents : (typeof items[Symbol.iterator] == 'function' ? [...items] : []);
}

export function hasSourced(actor, uuid) {
  return itemsOf(actor).some(item => sourceOf(item) == uuid);
}

export function countSourced(actor, uuid) {
  return itemsOf(actor).filter(item => sourceOf(item) == uuid).length;
}

/** Every world actor as an array - game.actors can be a Collection, an array, or (in tests) missing. */
export function worldActors() {
  const actors = globalThis.game?.actors;
  if (!actors) {
    return [];
  }

  if (Array.isArray(actors.contents)) {
    return actors.contents;
  }

  return typeof actors[Symbol.iterator] == 'function' ? [...actors] : [];
}

function resolve(uuid) {
  if (!uuid) {
    return null;
  }

  try {
    return globalThis.fromUuidSync?.(uuid) ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * The actor a companion belongs to.
 * @param {Actor} companion
 * @returns {Actor|null}
 */
export function ownerOf(companion) {
  return resolve(companion?.flags?.essence20?.[COMPANION_FLAG]);
}

/**
 * Every companion (and summoned vehicle) that belongs to this actor.
 * @param {Actor} owner
 * @param {Object} [options]
 * @param {String} [options.type]   Only this system.type (pet, drone, miniCon, human).
 * @returns {Array<Actor>}
 */
export function companionsOf(owner, { type = null } = {}) {
  if (!owner?.uuid) {
    return [];
  }

  const found = new Map();
  for (const entry of Object.values(owner.system?.actors ?? {})) {
    const actor = resolve(entry?.uuid);
    if (actor && ['companion', 'vehicle'].includes(actor.type)) {
      found.set(actor.uuid, actor);
    }
  }

  for (const actor of worldActors()) {
    if (actor?.flags?.essence20?.[COMPANION_FLAG] == owner.uuid) {
      found.set(actor.uuid, actor);
    }
  }

  return [...found.values()].filter(actor => !type || (actor.type == 'companion' && actor.system?.type == type));
}

/**
 * Whether two actors are a companion and its owner, either way round.
 */
export function isCompanionPair(a, b) {
  if (!a?.uuid || !b?.uuid) {
    return false;
  }

  const ownerA = a.flags?.essence20?.[COMPANION_FLAG];
  const ownerB = b.flags?.essence20?.[COMPANION_FLAG];
  return ownerA == b.uuid || ownerB == a.uuid || (!!ownerA && ownerA == ownerB);
}

/**
 * Tie a companion to its owner: the flag on the companion, and a row on the owner's sheet.
 * @param {Actor} owner
 * @param {Actor} companion
 */
export async function linkCompanion(owner, companion) {
  if (!owner || !companion) {
    return;
  }

  await companion.setFlag('essence20', COMPANION_FLAG, owner.uuid);
  const listed = Object.values(owner.system?.actors ?? {}).some(entry => entry?.uuid == companion.uuid);
  if (!listed && owner.system?.actors) {
    const { setEntryAndAddActor } = await import("../sheet-handlers/drop-handler.mjs");
    await setEntryAndAddActor(companion, owner);
  }
}

/**
 * Undo linkCompanion.
 */
export async function unlinkCompanion(owner, companion) {
  if (companion?.flags?.essence20?.[COMPANION_FLAG] == owner?.uuid) {
    await companion.unsetFlag('essence20', COMPANION_FLAG);
  }

  const key = Object.entries(owner?.system?.actors ?? {}).find(([, entry]) => entry?.uuid == companion?.uuid)?.[0];
  if (key) {
    await owner.update({ [`system.actors.${key}`]: new foundry.data.operators.ForcedDeletion() });
  }
}
