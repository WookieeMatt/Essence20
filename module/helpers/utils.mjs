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

  for (const pack of game.packs) {
    const compendium = game.packs.get(`essence20.${pack.metadata.name}`);
    if (compendium) {
      const compendiumItem = compendium.index.get(id);
      if (compendiumItem) {
        return compendiumItem;
      }
    }
  }
}

/**
* Get Items of a type
* @param {String} type  The type of Item to return
* @param {Item[]} items The Items to search through
* @returns {Item[]}     All Items of the type requested
*/
export function getItemsOfType(type, items) {
  const itemsOfType = [];
  for (const item of items) {
    if (item.type == type) {
      itemsOfType.push(item);
    }
  }

  return itemsOfType;
}

/**
 * Returns values of inputs upon dialog submission. Used for passing data between sequential dialogs.
 * @param {HTML} html   The html of the dialog upon submission
 * @returns {Object>}  The dialog inputs and their submitted values
 * @private
 */
export function rememberOptions(html) {
  const options = {};
  html.find("input").each((i, el) => {
    options[el.id] = el.checked;
  });

  return options;
}

/**
 * Creates copies of Items for given IDs
 * @param {String[]} ids The IDs of the Items to be copied
 * @param {Actor} owner  The Items' owner
 * @returns {String[]}   The IDs of the copied items
 */
export async function createItemCopies(ids, owner) {
  const copyIds = [];

  for (const id of ids) {
    let compendiumData = game.items.get(id);
    if (!compendiumData) {
      const item = searchCompendium(id);
      if (item) {
        compendiumData = item;
      }
    }

    const newItem = await Item.create(compendiumData, { parent: owner });
    copyIds.push(newItem._id);
  }

  return copyIds;
}

/**
* Handle deleting of items by an Id
* @param {String} id   ID of the item to delete
* @param {Actor} owner The Items' owner
*/
export function itemDeleteById(id, owner) {
  let item = owner.items.get(id);
  if (item) {
    item.delete();
  }
}

/**
 * Handle looking up tokens associated with actor and changing size
 */

export function resizeTokens(actor, width, height) {
  const tokens = actor.getActiveTokens();
  for (const token of tokens) {
    token.document.update({
      "height": height,
      "width": width,
    });
  }

}
