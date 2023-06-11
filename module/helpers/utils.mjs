/* -------------------------------------------- */
/*  Config Pre-Localization                     */
/* -------------------------------------------- */

/**
 * Storage for pre-localization configuration.
 * @type {object}
 * @private
 */
const _preLocalizationRegistrations = {};

/**
 * Mark the provided config key to be pre-localized during the init stage.
 * @param {string} configKey              Key within `CONFIG.DND5E` to localize.
 * @param {object} [options={}]
 * @param {string} [options.key]          If each entry in the config enum is an object,
 *                                        localize and sort using this property.
 * @param {string[]} [options.keys=[]]    Array of localization keys. First key listed will be used for sorting
 *                                        if multiple are provided.
 * @param {boolean} [options.sort=false]  Sort this config enum, using the key if set.
 */
export function preLocalize(configKey, { key, keys = [], sort = false } = {}) {
  if (key) keys.unshift(key);
  _preLocalizationRegistrations[configKey] = { keys, sort };
}

/**
 * Execute previously defined pre-localization tasks on the provided config object.
 * @param {object} config  The `CONFIG.DND5E` object to localize and sort. *Will be mutated.*
 */
export function performPreLocalization(config) {
  for (const [key, settings] of Object.entries(_preLocalizationRegistrations)) {
    _localizeObject(config[key], settings.keys);
    if (settings.sort) config[key] = sortObjectEntries(config[key], settings.keys[0]);
  }
}

/**
 * Localize the values of a configuration object by translating them in-place.
 * @param {object} obj       The configuration object to localize.
 * @param {string[]} [keys]  List of inner keys that should be localized if this is an object.
 * @private
 */
function _localizeObject(obj, keys) {
  for (const [k, v] of Object.entries(obj)) {
    const type = typeof v;
    if (type === "string") {
      obj[k] = game.i18n.localize(v);
      continue;
    }

    if (type !== "object") {
      console.error(new Error(
        `Pre-localized configuration values must be a string or object, ${type} found for "${k}" instead.`,
      ));
      continue;
    }

    if (!keys?.length) {
      console.error(new Error(
        "Localization keys must be provided for pre-localizing when target is an object.",
      ));
      continue;
    }

    for (const key of keys) {
      if (!v[key]) continue;
      v[key] = game.i18n.localize(v[key]);
    }
  }
}

/**
 * Retrieve the indexed data for a Document using its UUID. Will never return a result for embedded documents.
 * @param {string} uuid  The UUID of the Document index to retrieve.
 * @returns {object}     Document's index if one could be found.
 */
export function indexFromUuid(uuid) {
  const parts = uuid.split(".");
  let index;


  if (parts[0] === "Compendium") { // Compendium Documents
    const [, scope, packName, id] = parts;
    const pack = game.packs.get(`${scope}.${packName}`);
    index = pack?.index.get(id);
  } else if (parts.length < 3) {   // World Documents
    const [docName, id] = parts;
    const collection = CONFIG[docName].collection.instance;
    index = collection.get(id);
  }

  return index || null;
}

/**
  * Handles search of the Compendiums to find the item
  * @param {Item|String} item  Either an ID or an Item to find in the compendium
  * @returns {Item}     The Item, if found
  */
export function searchCompendium(item) {
  const id = item._id || item;

  for (const pack of game.packs){
    const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
    if (compendium) {
      const compendiumItem = compendium.index.get(id);
      if (compendiumItem) {
        return compendiumItem;
      }
    }
  }
}
