import { rememberOptions } from "../helpers/dialog.mjs";
import { createId, getItemsOfType } from "../helpers/utils.mjs";

/**
 * Handles dropping Items that have attachments onto an Actor
 * @param {Actor} actor The Actor receiving the Item
 * @param {Item} droppedItem The Item being dropped
 * @param {Function} dropFunc The function to call to complete the drop
 */
export async function gearDrop(actor, droppedItem, dropFunc) {
  const newGearList = await dropFunc();
  if (droppedItem.system.items) {
    await createItemCopies(droppedItem.system.items, actor, "upgrade", newGearList[0]);
    if (droppedItem.type == 'weapon') {
      await createItemCopies(droppedItem.system.items, actor, "weaponEffect", newGearList[0]);
    }
  }
}

/**
 * Creates copies of Items for given IDs
 * @param {Object[]} items The Item entries to copy
 * @param {Actor} owner The Items' owner
 * @param {String} type The type of Items to drop
 * @param {Item} parentItem The Items' parent Item
 * @param {Number} lastProcessedLevel The flag for the last time the Actor changed level
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
        if (newItem.type == "altMode") {
          await owner.update({
            "system.canTransform": true,
          });
        }

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
 * Initiates the process to apply an attachment Item to an Item on the Actor sheet
 * @param {Actor} actor The Actor receiving the attachment
 * @param {Item} droppedItem The attachment being dropped
 * @param {Function} dropFunc The function to call to complete the drop
 */
export async function attachItem(actor, droppedItem, dropFunc) {
  let parentType = "";
  if (droppedItem.system.type) {
    parentType = droppedItem.system.type;
  } else if (droppedItem.type == 'weaponEffect') {
    parentType = "weapon";
  }

  const upgradableItems = getItemsOfType(parentType, actor.items);

  if (upgradableItems.length == 1) {
    _attachItem(upgradableItems[0], dropFunc);
  } else if (upgradableItems.length > 1) {
    const choices = {};
    for (const upgradableItem of upgradableItems) {
      choices[upgradableItem._id] = {
        chosen: false,
        label: upgradableItem.name,
      };
    }

    new Dialog(
      {
        title: game.i18n.localize('E20.ItemSelect'),
        content: await renderTemplate("systems/essence20/templates/dialog/option-select.hbs", {
          choices,
        }),
        buttons: {
          save: {
            label: game.i18n.localize('E20.AcceptButton'),
            callback: html => _attachSelectedItemOptionHandler(
              actor, rememberOptions(html), dropFunc,
            ),
          },
        },
      },
    ).render(true);
  } else {
    ui.notifications.error(game.i18n.localize('E20.NoUpgradableItemsError'));
    return false;
  }
}

/**
 * Processes the options resulting from _showAttachmentDialog()
 * @param {Actor} actor The Actor receiving the attachment
 * @param {Object} options The options resulting from _showAttachmentDialog()
 * @param {Function} dropFunc The function to call to complete the drop
 * @private
 */
async function _attachSelectedItemOptionHandler(actor, options, dropFunc) {
  for (const [itemId, isSelected] of Object.entries(options)) {
    if (isSelected) {
      const item = actor.items.get(itemId);
      _attachItem(item, dropFunc);
      break;
    }
  }
}

/**
 * Creates the attachment for the Actor and attaches it to the given Item
 * @param {Item} targetItem The item to attach to
 * @param {Function} dropFunc The function to call to complete the drop
 * @private
 */
async function _attachItem(targetItem, dropFunc) {
  const newattachedItemList = await dropFunc();
  const newattachedItem = newattachedItemList[0];
  newattachedItem.setFlag('essence20', 'parentId', targetItem._id);
  if (targetItem) {
    const key = await setEntryAndAddItem(newattachedItem, targetItem);
    newattachedItem.setFlag('essence20', 'collectionId', key);
  }
}

/**
* Handles setting the value of the entry variable and calling the creating function
* @param {Item} droppedItem The Item that is being attached to the other Item
* @param {Item} atttachedItem The Item receiving the dropped Item
* @return {Promise<String>} The key generated for the dropped item
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
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "focus":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      return _addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "role") {
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "influence":
    if (droppedItem.type == "perk") {
      return _addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "hangUp") {
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "origin":
    if (droppedItem.type =="altMode") {
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }
    else if (droppedItem.type == "perk") {
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  case "role":
    if (droppedItem.type == "perk") {
      entry ['subtype'] = droppedItem.system.type;
      entry ['level'] = 1;
      return _addItemIfUnique(droppedItem, targetItem, entry);
    } else if (droppedItem.type == "rolePoints") {
      entry['bonus'] = droppedItem.system.bonus;
      entry['isActivatable'] = droppedItem.system.isActivatable;
      entry['isActive'] = droppedItem.system.isActive;
      entry['powerCost'] = droppedItem.system.powerCost;
      entry['resource'] = droppedItem.system.resource;
      return _addItemIfUnique(droppedItem, targetItem, entry);
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
      return _addItemIfUnique(droppedItem, targetItem, entry);
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
      return _addItemIfUnique(droppedItem, targetItem, entry);
    }

    break;
  default:
    break;
  }
}

/**
* Handles validating an Item being dropped is unique
* @param {Item} droppedItem The Item that was dropped
* @param {Item} targetItem The Item that was dropped onto
* @param {Object} entry The entry for the Item being added
* @return {Promise<String>} The key generated for the dropped Item
*/
export async function _addItemIfUnique(droppedItem, targetItem, entry) {
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
* Handles deleting Items attached to other items
* @param {Item} item The Item that was deleted
* @param {Actor} actor The Actor that owns the parent Item
* @param {Number} previousLevel (optional) The value of the last time the Actor leveled up
*/
export function deleteAttachmentsForItem(item, actor, previousLevel=null) {
  for (const actorItem of actor.items) {
    const itemSourceId = foundry.utils.isNewerVersion('12', game.version)
      ? actor.items.get(actorItem._id).getFlag('core', 'sourceId')
      : actor.items.get(actorItem._id)._stats.compendiumSource;
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
