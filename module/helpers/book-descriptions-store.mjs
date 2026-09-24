/**
 * Reading back the descriptions a GM imported from their own rulebook PDFs.
 *
 * Split out from helpers/book-descriptions.mjs so that module can stay free of any Foundry API
 * and be unit tested on plain arrays; everything here touches game.settings.
 *
 * The store itself is the `bookDescriptions` world setting, written by
 * apps/book-description-importer.mjs. It is grouped by book so a GM can see and remove what each
 * import contributed, but lookups are per item, so the books are flattened into one map here.
 */

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

    for (const book of Object.values(stored ?? {})) {
      for (const [uuid, text] of Object.entries(book?.descriptions ?? {})) {
        cache.set(uuid, text);
      }
    }
  }

  return cache.get(sourceUuid) ?? null;
}
