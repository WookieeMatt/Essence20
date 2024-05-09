import {
  checkIsLocked,
  parseId,
} from "../helpers/utils.mjs";
import { alterationUpdate } from "./alteration-handler.mjs";
import { attachItem, gearDrop } from "./attachment-handler.mjs";
import { influenceUpdate, originUpdate } from "./background-handler.mjs";
import { powerUpdate } from "./power-handler.mjs";
import { perkUpdate } from "./perk-handler.mjs";
import { focusUpdate, roleUpdate } from "./role-handler.mjs";

/**
 * Handle dropping an Item onto an Actor.
 * @param {DragEvent} event           The concluding DragEvent which contains drop data
 * @param {Object} data               The data transfer extracted from the event
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropItem(event, data, actor, superOnDropItem) {
  if (data.type != 'Item') {
    return false;
  }

  if (checkIsLocked(actor)) {
    return false;
  }

  const sourceItem = await fromUuid(data.uuid);
  if (!sourceItem) return false;

  // Don't drop a new item if they're just sorting
  if (actor.uuid === sourceItem?.parent?.uuid) {
    return await _onDropDefault(data, superOnDropItem, false);
  }

  switch (sourceItem.type) {
  case 'alteration':
    return await alterationUpdate(actor, sourceItem, superOnDropItem);
  case 'armor':
    return await gearDrop(actor, sourceItem, superOnDropItem);
  case 'focus':
    return await focusUpdate(actor, sourceItem, superOnDropItem);
  case 'influence':
    return await influenceUpdate(actor, sourceItem, superOnDropItem);
  case 'origin':
    return await originUpdate(actor, sourceItem, superOnDropItem);
  case 'role':
    return await roleUpdate(actor, sourceItem, superOnDropItem);
  case 'rolePoints':
    ui.notifications.error(game.i18n.localize('E20.RolePointsActorDropError'));
    return;
  case 'perk':
    return await perkUpdate(actor, sourceItem, superOnDropItem);
  case 'power':
    return await powerUpdate(actor, sourceItem, superOnDropItem);
  case 'upgrade':
    return await _onDropUpgrade(sourceItem, actor, superOnDropItem);
  case 'weapon':
    return await gearDrop(actor, sourceItem, superOnDropItem);
  case 'weaponEffect':
    return attachItem(actor, sourceItem, superOnDropItem);

  default:
    return await superOnDropItem;
  }
}

/**
 * Handle dropping of any other item an Actor sheet
 * @param {Object} data               The data transfer extracted from the event
 * @param {Boolean} isNewItem         Whether a new item is intended to be dropped
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
async function _onDropDefault(data, superOnDropItem, isNewItem=true) {
  const itemUuid = await parseId(data.uuid);
  let droppedItemList = await superOnDropItem;

  if (isNewItem) {
    const newItem = droppedItemList[0];
    await newItem.update ({
      "system.originalId": itemUuid,
    });
  } else {
    droppedItemList = [];
  }

  return droppedItemList;
}

/**
 * Handle dropping of an Actor data onto another Actor sheet
 * @param {DragEvent} event           The concluding DragEvent which contains drop data
 * @param {Object} data               The data transfer extracted from the event
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 * @override
 */
export async function onDropActor(event, data, actorSheet) {
  const actor = actorSheet.actor;
  if (!actor.isOwner) return false;

  // Get the target actor
  let sourceActor = await fromUuid(data.uuid);
  if (!sourceActor) return false;

  // Handles dropping Zords onto Megaform Zords
  if (actor.type == 'megaformZord' && sourceActor.type == 'zord') {
    const zordIds = duplicate(actor.system.zordIds);

    // Can't contain duplicate Zords
    if (!zordIds.includes(sourceActor.id)) {
      zordIds.push(sourceActor.id);
      await actor.update({
        "system.zordIds": zordIds,
      }).then(actorSheet.render(false));
    }
  } else {
    return false;
  }
}

/**
 * Handle dropping of an Upgrade onto an Actor sheet
 * @param {Upgrade} upgrade           The upgrade
 * @param {DragEvent} event           The concluding DragEvent which contains drop data
 * @param {Object} data               The data transfer extracted from the event
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
async function _onDropUpgrade(upgrade, actor, superOnDropItem) {
  // Drones can only accept drone Upgrades
  if (actor.type == 'companion' && actor.system.type == 'drone' && upgrade.system.type == 'drone') {
    return superOnDropItem();
  } else if (actor.system.canTransform && upgrade.system.type == 'armor') {
    return superOnDropItem();
  } else if (['armor', 'weapon'].includes(upgrade.system.type)) {
    return attachItem(actor, upgrade, superOnDropItem);
  } else {
    ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
    return false;
  }
}
