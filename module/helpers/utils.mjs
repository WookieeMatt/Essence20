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

/*
* Parse the UUID to get just the ID value of the item
* @param {string} uuid of the item that we are parsing for the id
* @return {string|null} index or null returned.
*/
export function parseId(uuid) {
  const parts = uuid.split(".");
  let index;

  if (parts[0] === "Compendium") { // Compendium Documents
    const [, , , , id] = parts;
    index = id;
  } else if (parts.length < 3) {   // World Documents
    const [, id] = parts;
    index = id;
  }

  return index || null;
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
 * Returns values of inputs upon dialog submission. Used for passing data between sequential dialogs.
 * (This one does values instead of checked)
 * @param {HTML} html   The html of the dialog upon submission
 * @returns {Object}  The dialog inputs and their entered values
 * @private
 */
export function rememberValues(html) {
  const options = {};
  html.find("input").each((i, el) => {
    options[el.id] = {
      max: el.max,
      value: el.value,
    };
  });

  return options;
}

/**
 * Creates copies of Items for given IDs
 * @param {Object[]} items The item entries to copy
 * @param {Actor} owner The items' owner
 * @param {String} type The type of items to drop
 * @param {Item} parentItem The items' parent item
 * @param {Number} lastProcessedLevel The flag for the last time the actor changed level
 */
export async function createItemCopies(items, owner, type, parentItem, lastProcessedLevel=null) {
  for (const [key, item] of Object.entries(items)) {
    if (item.type == type) {
      const createNewItem =
        parentItem.type != "role"
        || (item.level <= owner.system.level && (!lastProcessedLevel || (item.level > lastProcessedLevel)));

      if (createNewItem) {
        const itemToCreate = await fromUuid(item.uuid);
        const newItem = await Item.create(itemToCreate, { parent: owner });
        newItem.setFlag('core', 'sourceId', item.uuid);
        newItem.setFlag('essence20', 'collectionId', key);
        newItem.setFlag('essence20', 'parentId', parentItem._id);
      }
    }
  }
}

/**
 * Handle looking up tokens associated with actor and changing size
 * @param {Actor} actor  The actor
 * @param {Number} width The actor's new width
 * @param {Number} height The actor's new width
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

/**
 * Handle Shifting skills
 * @param {String} skill The skill shifting
 * @param {Number} shift The quantity of the shift
 * @param {Actor} actor  The actor
 * @return {String} newShift The value of the new Shift
 * @return {String} skillString The name of the skill being shifted
 */
export async function getShiftedSkill(skill, shift, actor) {
  let skillString = "";
  let currentShift = "";
  let newShift = "";

  if (skill == "initiative") {
    skillString = `system.${skill}.shift`;
    currentShift = actor.system[skill].shift;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - shift))];
  } else if (skill == "conditioning") {
    skillString = `system.${skill}`;
    currentShift = actor.system[skill];
    newShift = currentShift + shift;
  } else {
    currentShift = actor.system.skills[skill].shift;
    skillString = `system.skills.${skill}.shift`;
    newShift = CONFIG.E20.skillShiftList[Math.max(0, (CONFIG.E20.skillShiftList.indexOf(currentShift) - shift))];
  }

  return [newShift, skillString];
}

/** Handle comparing skill rank
 * @param {String} shift1 The first skill
 * @param {String} shift2 The second skill
 * @param {String} operator The type of comparison
 * @return {Boolean} The result of the comparison
 */
export function compareShift(shift1, shift2, operator) {
  if (operator == 'greater') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) < CONFIG.E20.skillShiftList.indexOf(shift2);
  } else if (operator == 'lesser') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) > CONFIG.E20.skillShiftList.indexOf(shift2);
  } else if (operator == 'equal') {
    return CONFIG.E20.skillShiftList.indexOf(shift1) == CONFIG.E20.skillShiftList.indexOf(shift2);
  } else {
    throw new Error(`Operator ${operator} not expected`);
  }
}

/*
 * Handle organizing selects by adding optGroups
 * @param {Select} select The select that you are organizing
 * @param {Category} category The category that we are adding to the options
 * @param {Items} items The types that you are putting in the category
 */
export function setOptGroup(select, category, items) {
  const options = select.querySelectorAll(":scope > option");
  const optGroup = document.createElement("optgroup");
  optGroup.label = category;

  for (const option of options) {
    if (items[option.value]) {
      optGroup.appendChild(option);
    }
  }

  return optGroup;
}

/**
 * Displays an error message if the sheet is locked
 * @returns {boolean} True if the sheet is locked, and false otherwise
 */
export function checkIsLocked(actor) {
  if (actor.system.isLocked) {
    ui.notifications.error(game.i18n.localize('E20.ActorLockError'));
    return true;
  }

  return false;
}

/**
* Generate a random ID
* Generate random number and convert it to base 36 and remove the '0.' at the beginning
* As long as the string is not long enough, generate more random data into it
* Use substring in case we generated a string with a length higher than the requested length
* @param length    The length of the random ID to generate
* @return          Return a string containing random letters and numbers
*/
export function randomId(length) {
  const multiplier = Math.pow(10, length);
  return Math.floor((1 + Math.random()) * multiplier)
    .toString(16)
    .substring(1);
}

/**
* Handles creating a unique 5 digit Id for an item
* @param {Array} items The items keyed by IDs
*/
export function createId(items) {
  let id = "";
  do {
    id = randomId(5);
  } while (items[id]);

  return id;
}

/**
* Handles validating an item being dropped is unique
* @param {Item} droppedItem The item that was dropped
* @param {Item} targetItem The item that was dropped on to.
* @param {Object} entry The entry for the item being added
*/
export async function addItemIfUnique(droppedItem, targetItem, entry) {
  const items = targetItem.system.items;
  if (items) {
    for (const [, item] of Object.entries(items)) {
      if (item.uuid === droppedItem.uuid) {
        return;
      }
    }
  }

  const pathPrefix = "system.items";

  const id = createId(items);

  await targetItem.update({
    [`${pathPrefix}.${id}`]: entry,
  });
}

/**
* Handles setting the value of the Entry variable and calling the creating function.
* @param {Item} droppedItem The item that is being attached on the item
* @param {Item} atttachedItem The item that we are attaching to.
*/
export function setEntryAndAddItem(droppedItem, targetItem) {
  const entry = {
    uuid: droppedItem.uuid,
    img: droppedItem.img,
    name: droppedItem.name,
    type: droppedItem.type,
  };

  switch (targetItem.type) {
  case "armor":
    if (droppedItem.type == "upgrade" && droppedItem.system.type == "armor") {
      entry['armorBonus'] = droppedItem.system.armorBonus;
      entry['availability'] = droppedItem.system.availability;
      entry['benefit'] = droppedItem.system.benefit;
      entry['description'] = droppedItem.system.description;
      entry['prerequisite'] = droppedItem.system.prerequisite;
      entry['source'] = droppedItem.system.source;
      entry['subtype'] = droppedItem.system.type;
      entry['traits'] = droppedItem.system.traits;
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "focus":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "influence":
    if (droppedItem.type == "perk") {
      addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "hangUp") {
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "origin":
    if (droppedItem.type == "perk") {
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "role":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "weapon":
    if (droppedItem.type == "upgrade" && droppedItem.system.type == "weapon") {
      entry['availability'] = droppedItem.system.availability;
      entry['benefit'] = droppedItem.system.benefit;
      entry['description'] = droppedItem.system.description;
      entry['prerequisite'] = droppedItem.system.prerequisite;
      entry['source'] = droppedItem.system.source;
      entry['subtype'] = droppedItem.system.type;
      entry['traits'] = droppedItem.system.traits;
      addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "weaponEffect") {
      entry['classification'] = droppedItem.system.classification;
      entry['damageValue'] = droppedItem.system.damageValue;
      entry['damageType'] = droppedItem.system.damageType;
      entry['numHands'] = droppedItem.system.numHands;
      entry['numTargets'] = droppedItem.system.numTargets;
      entry['radius'] = droppedItem.system.radius;
      entry['range'] = droppedItem.system.range;
      entry['shiftDown'] = droppedItem.system.shiftDown;
      entry['traits'] = droppedItem.system.traits;
      addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  default:
    break;
  }
}

/**
* Handles deleting items attached to other items
* @param {Item} item The item that was deleted
* @param {Actor} actor The actor the parent item is on
* @param {Value} previousLevel (optional) The value of the last time you leveled up.
*/
export function deleteAttachmentsForItem(item, actor, previousLevel=null) {
  for (const actorItem of actor.items) {
    for (const [, attachment] of Object.entries(item.system.items)) {
      const itemSourceId = actor.items.get(actorItem._id).getFlag('core', 'sourceId');
      const parentId = actor.items.get(actorItem._id).getFlag('essence20', 'parentId');
      if (itemSourceId == attachment.uuid) {
        if (item._id == parentId) {
          if (previousLevel) {
            if (attachment.level > actor.system.level && attachment.level <= previousLevel) {
              actorItem.delete();
            }
          } else {
            actorItem.delete();
          }
        }
      }
    }
  }
}

export async function roleValueChange(actor, change, array, previousLevel=null) {
  let totalChange = 0;
  if (change == "increase") {
    for (let i =0; i<array.length; i++) {
      const essenceLevel = array[i].replace(/[^0-9]/g, '');
      if (previousLevel) {
        if (essenceLevel <= actor.system.level && essenceLevel > previousLevel) {
          totalChange += 1;
        }
      } else {
        if (essenceLevel <= actor.system.level ) {
          totalChange += 1;
        }
      }
    }
  } else if (change == "decrease") {
    for (let i =0; i<array.length; i++) {
      const essenceLevel = array[i].replace(/[^0-9]/g, '');
      if (previousLevel) {
        if (essenceLevel > actor.system.level && essenceLevel <= previousLevel ) {
          totalChange += 1;
        }
      } else {
        if (essenceLevel > actor.system.level ) {
          totalChange += 1;
        }
      }
    }
  }

  return totalChange;
}

