import { checkIsLocked } from "../helpers/actor.mjs";
import { createId, parseId } from "../helpers/utils.mjs";
import { alterationUpdate } from "./alteration-handler.mjs";
import { attachItem, gearDrop } from "./attachment-handler.mjs";
import { influenceUpdate, originUpdate } from "./background-handler.mjs";
import { powerUpdate } from "./power-handler.mjs";
import { perkUpdate } from "./perk-handler.mjs";
import { focusUpdate, roleUpdate } from "./role-handler.mjs";
import { rememberSelect } from "../helpers/dialog.mjs";

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
  case 'giJoe':
  case 'pony':
  case 'powerRanger':
  case 'transformer':
    if (droppedActor.type =='zord' && targetActor.system.canHaveZord || droppedActor.type == 'contact') {
      setEntryAndAddActor(droppedActor, targetActor);
      dropisValid = true;
    }

    break;
  case 'megaformZord':
    if (droppedActor.type == 'zord' || droppedActor.system.canTransform) {
      setEntryAndAddActor (droppedActor, targetActor);
      dropisValid = true;
    }

    break;
  case 'vehicle':
    if (["giJoe", "npc", "pony", "powerRanger", "transformer"].includes(droppedActor.type)) {
      _selectVehicleLocation(droppedActor, targetActor);
      dropisValid = true;
    }

    break;
  case 'zord':
    if (["giJoe", "npc", "pony", "powerRanger", "transformer"].includes(droppedActor.type)) {
      _selectVehicleLocation(droppedActor, targetActor);
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

  new Dialog(
    {
      title: game.i18n.localize('E20.VehicleRoleSelect'),
      content: await renderTemplate("systems/essence20/templates/dialog/vehicle-role-select.hbs", {
        choices,
      }),
      buttons: {
        save: {
          label: game.i18n.localize('E20.AcceptButton'),
          callback: html => setEntryAndAddActor(droppedActor,targetActor, rememberSelect(html)),
        },
      },
    },
  ).render(true);
}

/**
 * Sets the entry value that will be stored in system.actors
 * @param {Actor} droppedActor Actor dropped on to another actor
 * @param {Actor} targetActor Actor that is being dropped on to
 * @param {Objects} options An optional parameter for if a vehicle role has been selected
 * @returns the key generated on the drop
 */
async function setEntryAndAddActor(droppedActor, targetActor, options) {
  const entry = {
    uuid: droppedActor.uuid,
    img: droppedActor.img,
    name: droppedActor.name,
    type: droppedActor.type,
  };

  if (["vehicle", "zord"].includes(targetActor.type)) {
    entry['vehicleRole'] = options.vehicleRole;
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
        return;
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
