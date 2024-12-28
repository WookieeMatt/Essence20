import { checkIsLocked } from "../helpers/actor.mjs";
import { createId, parseId } from "../helpers/utils.mjs";
import { onAlterationDrop } from "./alteration-handler.mjs";
import { onAttachmentDrop, onAttachableParentDrop, onEquipmentPackageDrop } from "./attachment-handler.mjs";
import { onInfluenceDrop, onOriginDrop } from "./background-handler.mjs";
import { onPowerDrop } from "./power-handler.mjs";
import { onPerkDrop } from "./perk-handler.mjs";
import { onFocusDrop, onRoleDrop } from "./role-handler.mjs";
import VehicleRoleSelectPrompt from "../apps/vehicle-role-select.mjs";

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

  let result = null;

  switch (sourceItem.type) {
  case 'alteration':
    result = await onAlterationDrop(actor, sourceItem, dropFunc);
    break;
  case 'armor':
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    break;
  case 'equipmentPackage':
    result = await onEquipmentPackageDrop(actor, sourceItem);
    break;
  case 'focus':
    result = await onFocusDrop(actor, sourceItem, dropFunc);
    break;
  case 'influence':
    result = await onInfluenceDrop(actor, sourceItem, dropFunc);
    break;
  case 'origin':
    result = await onOriginDrop(actor, sourceItem, dropFunc);
    break;
  case 'role':
    result = await onRoleDrop(actor, sourceItem, dropFunc);
    break;
  case 'rolePoints':
    ui.notifications.error(game.i18n.localize('E20.RolePointsActorDropError'));
    break;
  case 'perk':
    result = await onPerkDrop(actor, sourceItem, dropFunc);
    break;
  case 'power':
    result = await onPowerDrop(actor, sourceItem, dropFunc);
    break;
  case 'shield' :
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    break;
  case 'upgrade':
    result = await _onUpgradeDrop(sourceItem, actor, dropFunc);
    break;
  case 'weapon':
    result = await onAttachableParentDrop(actor, sourceItem, dropFunc);
    break;
  case 'weaponEffect':
    result = onAttachmentDrop(actor, sourceItem, dropFunc);
    break;

  default:
    result = await dropFunc();
  }

  if (result) {
    ui.notifications.info(
      game.i18n.format(
        'E20.ItemDropSuccess',
        {itemName: sourceItem.name, actorName: actor.name},
      ),
    );
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
async function _onUpgradeDrop(upgrade, actor, dropFunc) {
  // Drones can only accept drone Upgrades
  if (actor.type == 'companion' && actor.system.type == 'drone' && upgrade.system.type == 'drone') {
    return dropFunc();
  } else if (actor.system.canTransform && upgrade.system.type == 'armor') {
    return dropFunc();
  } else if (['armor', 'weapon'].includes(upgrade.system.type)) {
    return onAttachmentDrop(actor, upgrade, dropFunc);
  } else {
    ui.notifications.error(game.i18n.localize('E20.UpgradeDropError'));
    return false;
  }
}

/**
 * Handle dropping of an Actor data onto another Actor sheet
 * @param {Object} data The data transfer extracted from the event
 * @param {ActorSheet} actorSheet The ActorSheet who is being dropped on to
 * @returns {Promise<object|boolean>} A data object which describes the result of the drop, or false if the drop was
 *                                    not permitted.
 */
export async function onDropActor(data, actorSheet) {
  const targetActor = actorSheet.actor;
  if (!targetActor.isOwner) return false;

  // Get the target actor
  const droppedActor = await fromUuid(data.uuid);
  if (!droppedActor) return false;

  let dropIsValid = false;
  switch (targetActor.type) {
  case 'playerCharacter':
    if (droppedActor.type =='zord' && targetActor.system.canHaveZord || droppedActor.type == 'contact') {
      setEntryAndAddActor(droppedActor, targetActor);
      dropIsValid = true;
    }

    break;
  case 'megaform':
    if (droppedActor.type == 'zord' || droppedActor.system.canTransform) {
      setEntryAndAddActor (droppedActor, targetActor);
      dropIsValid = true;
    }

    break;
  case 'vehicle':
    if (droppedActor.type == "playerCharacter") {
      _selectVehicleLocation(droppedActor, targetActor);
      dropIsValid = true;
    }

    break;
  case 'zord':
    if (droppedActor.type == "playerCharacter") {
      _selectVehicleLocation(droppedActor, targetActor);
      dropIsValid = true;
    }

    break;
  }

  if (!dropIsValid) {
    ui.notifications.error(game.i18n.localize('E20.ActorDropError'));
  }
}

/**
 * Function to select where the actor is being seated
 * @param {Actor} droppedActor The actor that is being dropped
 * @param {Actor} targetActor The actor that is being dropped on to
 */
async function _selectVehicleLocation(droppedActor, targetActor) {
  const choices = {};

  for (const [key, name] of Object.entries(CONFIG.E20.vehicleRoles)) {
    choices[key] = {
      label: name,
      value: key,
    };
  }

  const title = "E20.VehicleRoleSelect";
  new VehicleRoleSelectPrompt(droppedActor, targetActor, choices, title).render(true);
}

/**
 *
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {String} newRole The Vehicle role that was selected
 * @returns {boolean} allowDrop
 */
export function verifyDropSelection(targetActor, newRole){
  let numberOfType = 0;
  let allowDrop = false;
  for (const [,passenger] of Object.entries(targetActor.system.actors)) {
    if (passenger.vehicleRole == newRole) {
      numberOfType++;
    }
  }

  if (newRole == 'driver') {
    if (numberOfType < targetActor.system.crew.numDrivers) {
      allowDrop = true;
    }
  } else {
    if (numberOfType < targetActor.system.crew.numPassengers) {
      allowDrop = true;
    }
  }

  return allowDrop;
}

/**
 * Sets the entry value that will be stored in system.actors
 * @param {Actor} droppedActor Actor dropped on to another actor
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {String} newRole The Vehicle role the dropped actor is being assigned
 * @returns the key generated on the drop
 */
export async function setEntryAndAddActor(droppedActor, targetActor, newRole) {
  const entry = {
    uuid: droppedActor.uuid,
    img: droppedActor.img,
    name: droppedActor.name,
    type: droppedActor.type,
  };

  if (["vehicle", "zord"].includes(targetActor.type)) {
    entry['vehicleRole'] = newRole;
  }

  return addActorIfUnique(droppedActor, targetActor, entry);
}

/**
 * Adds the dropped actor into system.actors
 * @param {Actor} droppedActor Actor dropped on to another actor
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {Object} entry The value to be written to the system.actors
 * @returns key that is set for the actor
 */
async function addActorIfUnique(droppedActor, targetActor, entry) {
  const actors = targetActor.system.actors;
  if (actors) {
    for (const [, actor] of Object.entries(actors)) {
      if (actor.uuid === droppedActor.uuid) {
        if (actor.type != "npc") {
          ui.notifications.error(game.i18n.localize('E20.ActorDuplicateDrop'));
          return;
        }
      }
    }
  }

  const pathPrefix = "system.actors";
  const key = createId(actors);

  await targetActor.update({
    [`${pathPrefix}.${key}`]: entry,
  });

  return key;
}
