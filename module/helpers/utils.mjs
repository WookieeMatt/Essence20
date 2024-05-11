/*
* Parse the UUID to get just the ID value of the item
* @param {string} uuid of the item that we are parsing for the id
* @return {string|null} index or null returned.
*/
export function parseId(uuid) {
  const parts = uuid.split(".");
  const index = parts[(parts.length-1)];

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
        !["role", "focus"].includes(parentItem.type)
        || !item.level || (item.level <= owner.system.level && (!lastProcessedLevel || (item.level > lastProcessedLevel)));

      if (createNewItem) {
        const itemToCreate = await fromUuid(item.uuid);
        const newItem = await Item.create(itemToCreate, { parent: owner });

        if (["upgrade", "weaponEffect"].includes(newItem.type) && ["weapon", "armor"].includes(parentItem.type)) {
          const newKey = await setEntryAndAddItem(newItem, parentItem);
          newItem.setFlag('essence20', 'collectionId', newKey);

          const deleteString = `system.items.-=${key}`;
          await parentItem.update({[deleteString]: null});
        } else {
          newItem.setFlag('essence20', 'collectionId', key);
        }

        newItem.setFlag('core', 'sourceId', item.uuid);
        newItem.setFlag('essence20', 'parentId', parentItem._id);
      }
    }
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
export function getShiftedSkill(skill, shift, actor) {
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
* @return {String} The key generated for the dropped item
*/
export async function addItemIfUnique(droppedItem, targetItem, entry) {
  const items = targetItem.system.items;
  if (items) {
    for (const [, item] of Object.entries(items)) {
      if (droppedItem.type == 'rolePoints' && item.type == 'rolePoints') {
        ui.notifications.error(game.i18n.localize('E20.RolePointsMultipleError'));
        return;
      }

      if (item.uuid === droppedItem.uuid) {
        return;
      }
    }
  }

  const pathPrefix = "system.items";
  const key = createId(items);

  await targetItem.update({
    [`${pathPrefix}.${key}`]: entry,
  });

  return key;
}

/**
* Handles setting the value of the Entry variable and calling the creating function.
* @param {Item} droppedItem The item that is being attached on the item
* @param {Item} atttachedItem The item that we are attaching to.
* @return {String} The key generated for the dropped item
*/
export async function setEntryAndAddItem(droppedItem, targetItem) {
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
      return await addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "focus":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      return await addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "role") {
      return await addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "influence":
    if (droppedItem.type == "perk") {
      return await addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "hangUp") {
      return await addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "origin":
    if (droppedItem.type == "perk") {
      return await addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "role":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      return await addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "rolePoints") {
      entry['bonus'] = droppedItem.system.bonus;
      entry['isActivatable'] = droppedItem.system.isActivatable;
      entry['isActive'] = droppedItem.system.isActive;
      entry['powerCost'] = droppedItem.system.powerCost;
      entry['resource'] = droppedItem.system.resource;
      return await addItemIfUnique(droppedItem, targetItem, entry);
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
      return await addItemIfUnique(droppedItem, targetItem, entry);
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
      return await addItemIfUnique(droppedItem, targetItem, entry);
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
    const itemSourceId = actor.items.get(actorItem._id).getFlag('core', 'sourceId');
    const parentId = actor.items.get(actorItem._id).getFlag('essence20', 'parentId');
    const collectionId = actor.items.get(actorItem._id).getFlag('essence20', 'collectionId');

    for (const [key, attachment] of Object.entries(item.system.items)) {
      if (itemSourceId) {
        if (itemSourceId == attachment.uuid && item._id == parentId) {
          if (!previousLevel || (attachment.level > actor.system.level && attachment.level <= previousLevel)) {
            actorItem.delete();
          }
        }
      } else if (item._id == parentId && key == collectionId) {
        actorItem.delete();
      }
    }
  }
}

/**
 * @param {Object} actor The acrot that the role is attached to
 * @param {Array} arrayLevels An array of the levels at which a value changes
 * @param {Number} lastProcessedLevel The value of actor.system.level the last time a level change was processed
 * @returns {Number} totalChange The number of level changes.
 */
export function roleValueChange(currentLevel, arrayLevels, lastProcessedLevel=null) {
  const levelDiff = currentLevel - lastProcessedLevel;
  if (!levelDiff) {
    return 0;
  }

  const isLevelUp = currentLevel > lastProcessedLevel;
  const changeIncrement = isLevelUp ? 1 : -1;
  let totalChange = 0;

  for (const arrayLevel of arrayLevels) {
    const level = arrayLevel.replace(/[^0-9]/g, '');
    const actorReachedLevel =
          isLevelUp && level <= currentLevel
      || !isLevelUp && level > currentLevel;
    const levelNotYetProcessed =
      !lastProcessedLevel
      || (isLevelUp  && level >  lastProcessedLevel)
      || (!isLevelUp && level <= lastProcessedLevel);
    const valueChange = actorReachedLevel && levelNotYetProcessed;
    totalChange += valueChange ? changeIncrement : 0;
  }

  return totalChange;
}

/**
 * Handles setting the values and items for an actor's role
 * @param {Object} role The actor's Role
 * @param {Actor} actor The actor
 * @param {Number} newLevel (Optional) The new level that you are changing to
 * @param {Number} previousLevel (Optional) The last level processed for the actor
 */
export async function setRoleValues(role, actor, newLevel=null, previousLevel=null) {
  for (const essence in role.system.essenceLevels) {
    const totalChange = roleValueChange(actor.system.level, role.system.essenceLevels[essence], previousLevel);
    const essenceValue = actor.system.essences[essence] + totalChange;
    const essenceString = `system.essences.${essence}`;

    await actor.update({
      [essenceString]: essenceValue,
    });
  }

  if (role.system.powers.personal.starting) {
    const totalChange = roleValueChange(actor.system.level, role.system.powers.personal.levels, previousLevel);
    let newPersonalPowerMax = 0;
    if (actor.system.powers.personal.max > 0) {
      newPersonalPowerMax = actor.system.powers.personal.max + role.system.powers.personal.increase * totalChange;
    } else {
      newPersonalPowerMax = role.system.powers.personal.starting;
    }

    await actor.update({
      "system.powers.personal.max": newPersonalPowerMax,
      "system.powers.personal.regeneration": role.system.powers.personal.regeneration,
    });
  }

  if (role.system.adjustments.health.length) {
    const totalChange = roleValueChange(actor.system.level, role.system.adjustments.health, previousLevel);
    const newHealthBonus = actor.system.health.bonus + totalChange;

    await actor.update({
      "system.health.bonus": newHealthBonus,
    });
  }

  if (role.system.skillDie.isUsed) {
    const skillName = "roleSkillDie";
    const shiftList = CONFIG.E20.skillShiftList;
    const totalChange = roleValueChange(actor.system.level, role.system.skillDie.levels, previousLevel);
    let initialShiftIndex = shiftList.findIndex(s => s == "d2");
    if (actor.system.skills[skillName].shift) {
      initialShiftIndex = shiftList.findIndex(s => s == actor.system.skills[skillName].shift);
    }

    const finalShiftIndex = Math.max(
      0,
      Math.min(shiftList.length - 1, initialShiftIndex-totalChange),
    );

    const skillStringShift = `system.skills.${skillName}.shift`;
    const skillStringIsSpecialized = `system.skills.${skillName}.isSpecialized`;

    let isSpecialized = false;
    for (const arrayLevel of role.system.skillDie.specializedLevels) {
      const level = arrayLevel.replace(/[^0-9]/g, '');
      if (actor.system.level == level) {
        isSpecialized = true;
        break;
      }
    }

    await actor.update({
      [skillStringShift]: shiftList[finalShiftIndex],
      [skillStringIsSpecialized] : isSpecialized,
    });
  }

  for (const [,item] of Object.entries(role.system.items)) {
    if (item.type == "rolePoints" && actor.flags.essence20.roleDrop) {
      await createItemCopies(role.system.items, actor, "rolePoints", role);
      // Set points value to max?
    }
  }

  if (newLevel && previousLevel && newLevel > previousLevel || (!newLevel && !previousLevel)) {
    // Drop or level up
    await createItemCopies(role.system.items, actor, "perk", role, previousLevel);
  } else {
    // Level down
    await deleteAttachmentsForItem(role, actor, previousLevel);
  }

  actor.setFlag('essence20', 'roleDrop', false);
}

/**
 * Handles setting the values and items for an actor's focus
 * @param {Focus} focus The actor's Focus
 * @param {Actor} actor The actor
 * @param {Number} newLevel (Optional) The new level that you are changing to
 * @param {Number} previousLevel (Optional) The last level processed for the actor
 */
export async function setFocusValues(focus, actor, newLevel=null, previousLevel=null) {
  const totalChange = roleValueChange(actor.system.level, focus.system.essenceLevels, previousLevel);
  const essenceValue = actor.system.essences[actor.system.focusEssence] + totalChange;
  const essenceString = `system.essences.${actor.system.focusEssence}`;

  await actor.update({
    [essenceString]: essenceValue,
  });

  if (newLevel && previousLevel && newLevel > previousLevel || (!newLevel && !previousLevel)) {
    // Drop or level up
    await createItemCopies(focus.system.items, actor, "perk", focus, previousLevel);
  } else {
    // Level down
    await deleteAttachmentsForItem(focus, actor, previousLevel);
  }
}
