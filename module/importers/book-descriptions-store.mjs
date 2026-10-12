/**
 * Reading back the descriptions a GM imported from their own rulebook PDFs.
 *
 * Split out from importers/book-descriptions.mjs so that module can stay free of any Foundry API
 * and be unit tested on plain arrays; everything here touches game.settings.
 *
 * The store itself is the `bookDescriptions` world setting, written by
 * apps/book-description-importer.mjs. It is grouped by book so a GM can see and remove what each
 * import contributed, but lookups are per item, so the books are flattened into one map here.
 */

import { MOVED_ITEM_UUIDS, currentUuid } from "../items/shared/item-lookups.mjs";

/** @type {?Map<string, string>} Flattened uuid -> description, rebuilt on demand. */
let cache = null;

/**
 * Drop the cached lookup.
 *
 * Called from the setting's own onChange (settings.js), which covers an import, a removal, and a
 * change made by another connected client alike.
 */
export function invalidateImportedDescriptions() {
  cache = null;
}

/**
 * The description a GM imported for a given compendium item, if any.
 *
 * This runs from Item#prepareDerivedData, which fires for every item on the actor every time
 * anything is prepared, so it has to be cheap - hence flattening all books into a single Map once
 * and holding it until the setting changes rather than walking the stored object per lookup.
 * @param {string} sourceUuid   The item's compendium uuid.
 * @returns {?string} The imported text, or null when nothing was imported for it.
 */
export function importedDescription(sourceUuid) {
  if (!sourceUuid) {
    return null;
  }

  if (!cache) {
    cache = new Map();

    // Preparation can run before settings exist (during early setup, and in tests), which is not
    // an error - it just means nothing has been imported yet as far as this call can tell. The
    // cache is dropped again by onChange, so a later real read still populates.
    let stored;
    try {
      stored = game.settings?.get("essence20", "bookDescriptions");
    } catch {
      cache = null;
      return null;
    }

    // Nothing there before the world is ready may only mean its settings aren't in yet: don't hold on to that, or every
    // item would show no import until the setting next changes.
    if (!globalThis.game?.ready && !Object.keys(stored ?? {}).length) {
      cache = null;
      return null;
    }

    for (const book of Object.values(stored ?? {})) {
      for (const [uuid, text] of Object.entries(book?.descriptions ?? {})) {
        cache.set(uuid, text);
      }
    }
  }

  // A copy made before its item moved pack still names the old uuid (item-lookups.mjs#MOVED_ITEM_UUIDS).
  return cache.get(sourceUuid) ?? cache.get(currentUuid(sourceUuid)) ?? null;
}

/**
 * The stored imports with every entry that no longer finds its compendium item pointed at one that does. An update can
 * move an item to another pack or replace it (6.0.4 moved A Jump Through Time's Spectrum Modifications out of the
 * Power Rangers core pack): the text was keyed by the old uuid and quietly stopped showing.
 *  1. a known move (item-lookups.mjs#MOVED_ITEM_UUIDS);
 *  2. the same item id in another pack;
 *  3. for an import that recorded its items' names (`items`, from 2026-10-09 on), an item of that name and type in
 *     that book.
 * Pure: the lookups are passed in. Exported for tests.
 * @param {Object} stored   The bookDescriptions setting.
 * @param {Object} lookups   {exists(uuid), moved(uuid), byId(id), byName(book, name, type)} - each a uuid or null/false.
 * @returns {{stored: Object, healed: Number, dead: Number}}
 */
export function healStoredDescriptions(stored, { exists, moved = () => null, byId = () => null, byName = () => null }) {
  let healed = 0;
  let dead = 0;
  const result = {};
  for (const [book, data] of Object.entries(stored ?? {})) {
    const descriptions = {};
    const items = { ...(data?.items ?? {}) };
    for (const [uuid, text] of Object.entries(data?.descriptions ?? {})) {
      if (exists(uuid)) {
        descriptions[uuid] = text;
        continue;
      }

      const id = uuid.split('.').at(-1);
      const known = items[uuid];
      const found = [moved(uuid), byId(id), known ? byName(book, known.name, known.type) : null]
        .find(candidate => candidate && exists(candidate) && !(candidate in descriptions));
      if (found) {
        descriptions[found] = text;
        if (known) {
          items[found] = known;
          delete items[uuid];
        }

        healed += 1;
      } else {
        descriptions[uuid] = text;
        dead += 1;
      }
    }

    result[book] = { ...data, descriptions, ...(data?.items ? { items } : {}) };
  }

  return { stored: result, healed, dead };
}

/** How many of a book's imported descriptions still find their compendium item. */
export function liveCount(data, exists) {
  return Object.keys(data?.descriptions ?? {}).filter(uuid => exists(uuid)).length;
}

/** Whether a compendium uuid names an item the compendiums have now (their indexes are loaded once the world is ready). */
export function compendiumItemExists(uuid) {
  const [scope, pack, , id] = String(uuid ?? '').split('.').slice(1);
  return !!globalThis.game?.packs?.get?.(`${scope}.${pack}`)?.index?.has?.(id);
}

/**
 * On ready (the active GM): re-key every import whose item moved since (healStoredDescriptions), and save it when that
 * changed anything. Returns {healed, dead}.
 */
export async function healBookDescriptions() {
  if (!globalThis.game?.users?.activeGM?.isSelf) {
    return { healed: 0, dead: 0 };
  }

  const stored = game.settings.get("essence20", "bookDescriptions") ?? {};
  if (!Object.keys(stored).length) {
    return { healed: 0, dead: 0 };
  }

  // Every Item pack's id and name index, once.
  const ids = new Map();
  const names = new Map();
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    const index = await pack.getIndex({ fields: ["system.source.book"] });
    for (const entry of index) {
      const uuid = `Compendium.${pack.metadata.id}.Item.${entry._id}`;
      // An id found in two packs is no clue at all.
      ids.set(entry._id, ids.has(entry._id) ? false : uuid);
      const key = `${entry.system?.source?.book ?? ''}|${entry.type}|${entry.name}`.toLowerCase();
      names.set(key, names.has(key) ? false : uuid);
    }
  }

  const { normalizeBookTitle } = await import("./book-descriptions.mjs");
  const result = healStoredDescriptions(stored, {
    exists: compendiumItemExists,
    moved: uuid => MOVED_ITEM_UUIDS[uuid] ?? null,
    byId: id => ids.get(id) || null,
    byName: (book, name, type) => {
      for (const [key, uuid] of names) {
        const [keyBook, keyType, keyName] = key.split('|');
        if (uuid && keyType == String(type).toLowerCase() && keyName == String(name).toLowerCase()
          && normalizeBookTitle(keyBook) == normalizeBookTitle(book)) {
          return uuid;
        }
      }

      return null;
    },
  });

  if (result.healed) {
    await game.settings.set("essence20", "bookDescriptions", result.stored);
    console.log(`Essence20 | Book descriptions: ${result.healed} re-linked to items that moved, ${result.dead} no longer found.`);
  }

  return { healed: result.healed, dead: result.dead };
}
