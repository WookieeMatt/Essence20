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
 * @param {Object} data The data transfer extracted from the event
 * @param {Actor} actor The Actor receiving the Item
 * @param {Function} dropFunc The function to call to complete the Item drop
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropItem(data, actor, dropFunc) {
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
    return await _onDropDefault(data, dropFunc, false);
  }

  switch (sourceItem.type) {
  case 'alteration':
    return await alterationUpdate(actor, sourceItem, dropFunc);
  case 'armor':
    return await gearDrop(actor, sourceItem, dropFunc);
  case 'focus':
    return await focusUpdate(actor, sourceItem, dropFunc);
  case 'influence':
    return await influenceUpdate(actor, sourceItem, dropFunc);
  case 'origin':
    return await originUpdate(actor, sourceItem, dropFunc);
  case 'role':
    return await roleUpdate(actor, sourceItem, dropFunc);
  case 'rolePoints':
    ui.notifications.error(game.i18n.localize('E20.RolePointsActorDropError'));
    return;
  case 'perk':
    return await perkUpdate(actor, sourceItem, dropFunc);
  case 'power':
    return await powerUpdate(actor, sourceItem, dropFunc);
  case 'upgrade':
    return await _onDropUpgrade(sourceItem, actor, dropFunc);
  case 'weapon':
    return await gearDrop(actor, sourceItem, dropFunc);
  case 'weaponEffect':
    return attachItem(actor, sourceItem, dropFunc);

  default:
    return await dropFunc();
  }
}

/**
 * Handle dropping of any other item an Actor sheet
 * @param {Object} data The data transfer extracted from the event
 * @param {Function} dropFunc The function to call to complete the Item drop
 * @param {Boolean} isNewItem Whether a new Item is intended to be dropped
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
async function _onDropDefault(data, dropFunc, isNewItem=true) {
  const itemUuid = await parseId(data.uuid);
  let droppedItemList = await dropFunc();

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
 * Handle dropping of an Upgrade onto an Actor sheet
 * @param {Upgrade} upgrade The Upgrade being dropped
 * @param {Actor} actor The Actor receiving the Upgrade
 * @param {Function} dropFunc The function to call to complete the Upgrade drop
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
async function _onDropUpgrade(upgrade, actor, dropFunc) {
  // Drones can only accept drone Upgrades
  if (actor.type == 'companion' && actor.system.type == 'drone' && upgrade.system.type == 'drone') {
    return dropFunc();
  } else if (actor.system.canTransform && upgrade.system.type == 'armor') {
    return dropFunc();
  } else if (['armor', 'weapon'].includes(upgrade.system.type)) {
    return attachItem(actor, upgrade, dropFunc);
  } else {
    ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
    return false;
  }
}

/**
 * Handle dropping of an Actor data onto another Actor sheet
 * @param {Object} data The data transfer extracted from the event
 * @param {ActorSheet} actorSheet The ActorSheet whose rest button was clicked
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropActor(data, actorSheet) {
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
