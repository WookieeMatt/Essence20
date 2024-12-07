import ChoicesPrompt from "../apps/choices-prompt.mjs";
import { checkIsLocked } from "../helpers/actor.mjs";
import { getItemsOfType } from "../helpers/utils.mjs";
import { onAlterationDelete } from "./alteration-handler.mjs";
import { deleteAttachmentsForItem, setEntryAndAddItem } from "./attachment-handler.mjs";
import { onOriginDelete } from "./background-handler.mjs";
import { onPerkDelete } from "./perk-handler.mjs";
import { onFocusDelete, onRoleDelete } from "./role-handler.mjs";
import { onAltModeDelete } from "./transformer-handler.mjs";

/**
 * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
 * @param {Event} event The originating click event
 * @param {Actor} actor The Actor creating the Item
 */
export async function onItemCreate(event, actor) {
  event.preventDefault();

  if (checkIsLocked(actor)) {
    return;
  }

  const header = event.currentTarget;
  // Get the type of item to create.
  const type = header.dataset.type;
  // Grab any data associated with this control.
  const data = foundry.utils.duplicate(header.dataset);
  // Initialize a default name.
  const name = `New ${type.capitalize()}`;
  // Prepare the item object.
  const itemData = {
    name: name,
    type: type,
    system: data,
  };

  // Remove the type from the dataset since it's in the itemData.type prop.
  delete itemData.system["type"];

  // Set the parent item type for nested items
  let parentItem = null;
  if (data.parentId) {
    parentItem = actor.items.get(data.parentId);
    itemData.system.type = parentItem.type;
  }

  // Finally, create the item!
  const newItem = await Item.create(itemData, { parent: actor });

  if (parentItem) {
    newItem.setFlag('essence20', 'parentId', parentItem._id);

    let key = null;

    // Update parent item's ID list for upgrades and weapon effects
    if (newItem.type == 'upgrade' && ['armor', 'weapon'].includes(parentItem.type)) {
      key = await setEntryAndAddItem(newItem, parentItem);
    } else if (newItem.type == 'weaponEffect' && parentItem.type == 'weapon') {
      key = await setEntryAndAddItem(newItem, parentItem);
    }

    newItem.setFlag('essence20', 'collectionId', key);
  }
}

/**
 * Handle editing an owned Item for the actor
 * @param {Event} event The originating click event
 * @param {Actor} actor The Actor editing the Item
 */
export async function onItemEdit(event, actor) {
  event.preventDefault();
  const li = $(event.currentTarget).closest(".item");
  let item = null;

  const itemId = li.data("itemId");
  if (itemId) {
    item = actor.items.get(itemId) || game.items.get(itemId);
  } else {
    const itemUuid = li.data("itemUuid");
    item = await fromUuid(itemUuid);
  }

  if (item) {
    item.sheet.render(true);
  }
}

/**
 * Handle deleting Items
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet the Item is being deleted on
 */
export async function onItemDelete(event, actorSheet) {
  const actor = actorSheet.actor;
  if (checkIsLocked(actor)) {
    return;
  }

  let item = null;
  const li = $(event.currentTarget).closest(".item");
  const itemId = li.data("itemId");
  const parentId = li.data("parentId");
  const parentItem = actor.items.get(parentId);

  if (itemId) {
    item = actor.items.get(itemId);
  } else {
    const keyId = li.data("itemKey");

    // If the deleted item is attached to another item find what it is attached to.
    for (const attachedItem of actor.items) {
      const collectionId = await attachedItem.getFlag('essence20', 'collectionId');
      if (collectionId) {
        if (keyId == collectionId) {
          item = attachedItem;
        }
      }
    }
  }

  // return if no item is found.
  if (!item) {
    return;
  }

  // Confirmation dialog
  const confirmation = await _getItemDeleteConfirmDialog(item);
  if (confirmation != 'confirm') {
    return;
  }

  // Check if this item has a parent item, such as for deleting an upgrade from a weapon
  if (parentItem) {
    const id = li.data("itemKey");
    const updateString = `system.items.-=${id}`;

    await parentItem.update({[updateString]: null});

    item.delete();
    li.slideUp(200, () => actorSheet.render(false));
  } else {
    if (item.type == "alteration") {
      onAlterationDelete(actor, item);
    } else if (item.type == "altMode") {
      onAltModeDelete(actorSheet, item);
    } else if (item.type == "armor") {
      deleteAttachmentsForItem(item, actor);
    } else if (item.type == "focus") {
      onFocusDelete(actor, item);
    } else if (item.type == 'influence') {
      deleteAttachmentsForItem(item, actor);
    } else if (item.type == "origin") {
      onOriginDelete(actor, item);
    } else if (item.type == "perk") {
      onPerkDelete(actor, item);
    } else if (item.type == "role") {
      onRoleDelete(actor, item);
    } else if (item.type == "weapon") {
      deleteAttachmentsForItem(item, actor);
    }

    item.delete();
    li.slideUp(200, () => actorSheet.render(false));
  }
}

/**
 * Displays the dialog used for confirming actor item deletion.
 * @param {Item} item The item being deleted.
 * @returns {Promise<Dialog>} The dialog to be displayed.
 */
export async function _getItemDeleteConfirmDialog(item) {
  const confirmation = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("E20.ItemDeleteConfirmTitle")},
    classes: [
      "window-app",
    ],
    content: `<p>${game.i18n.format("E20.ItemDeleteConfirmContent", {name: item.name})}</p>`,
    modal: true,

    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        /* eslint-disable no-unused-vars */
      },
      {
        label: game.i18n.localize('E20.DialogCancelButton'),
        action: 'cancel',
        /* eslint-disable no-unused-vars */
      },
    ],
  });

  return confirmation;
}

/**
 * Handle editing specialization names inline
 * @param {Actor} actor The Actor editing the Item
 * @param {Event} event The originating click event
 */
export async function onInlineEdit(event, actor) {
  event.preventDefault();

  let item;
  let element = event.currentTarget;
  const dataset = element.closest(".item").dataset;
  const itemId = dataset.itemId;
  const itemUuid = dataset.itemUuid;
  const parentId = dataset.parentId;
  const newValue = element.type == 'checkbox' ? element.checked : element.value;

  // If a child item is being updated, update the parent's copy too
  if (!itemId && itemUuid && parentId) {
    item = await fromUuid(itemUuid);

    const parentItem = actor.items.get(parentId);
    const parentField = element.dataset.parentField;
    await parentItem.update({ [parentField]: newValue });
  } else {
    item = actor.items.get(itemId);
  }

  const field = element.dataset.field;
  return item.update({ [field]: newValue });
}

/**
 * Handles activating and deactivating the shield
 * @param {Event} event The activation or deactivation of the shield.
 * @param {ActorSheet} actorSheet The ActorSheet that the shield is attached to.
 */
export async function onShieldActivationToggle(event, actorSheet) {
  const actor = actorSheet.actor;
  const shields = await getItemsOfType('shield', actor.items);
  let currentShield = null;
  for (const shield of shields) {
    if (shield._id == event.currentTarget.dataset.id) {
      currentShield = shield;
      break;
    }
  }

  if (!currentShield.system.equipped) {
    ui.notifications.error(game.i18n.localize('E20.ShieldNotEquipped'));
    return;
  }

  for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
    const shieldString = `system.defenses.${defenseType}.shield`;
    await actor.update({
      [shieldString] : 0,
    });
  }

  const stateString = currentShield.system.active ?  'passiveEffect' : 'activeEffect';
  shieldUpdate(actor, currentShield, stateString);
}

/**
 * Handles equipping a shield
 * @param {Event} event The event that is the equip or unequip
 * @param {ActorSheet} actorSheet The ActorSheet that the shield is being equipped or unequipped on
 */
export async function onShieldEquipToggle(event, actorSheet) {
  const actor = actorSheet.actor;
  const shields = await getItemsOfType('shield', actor.items);
  let currentShield = null;
  for (const shield of shields) {
    if (shield._id == event.currentTarget.dataset.id) {
      currentShield = shield;
    }
  }

  if (event.currentTarget.checked) {
    shieldUpdate(actor, currentShield, 'passiveEffect');
  } else {
    for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
      const shieldString = `system.defenses.${defenseType}.shield`;
      await actor.update({
        [shieldString] : 0,
      });
    }

    currentShield.update({
      ["system.active"]: false,
    });
  }
}

/**
 * Handles setting the values of the shield that were selected from the prompt
 * @param {Actor} actor The actor that owns the shield
 * @param {Item} currentShield The shield that we are setting values from
 * @param {String} stateString The state the shield is going to
 */
async function shieldUpdate(actor, currentShield, stateString) {
  const shieldState = currentShield.system[stateString];

  if (shieldState.type == "defenseBonus" || shieldState.type == "defenseBonusCombo") {
    const shieldString = `system.defenses.${shieldState.option1.defense}.shield`;
    await actor.update({
      [shieldString] : shieldState.option1.value,
    });
  } else if (shieldState.type == "defenseBonusOption" || shieldState.type == "defenseBonusMixed" ) {
    const choices = {};
    const label1 = game.i18n.localize(CONFIG.E20.defenses[shieldState.option1.defense]) + " +" + shieldState.option1.value;
    choices["option1"] = {
      name: shieldState.option1.defense,
      label: label1,
      value: shieldState.option1.value,
    };
    if (shieldState.type == "defenseBonusOption") {
      const label2 = game.i18n.localize(CONFIG.E20.defenses[shieldState.option2.defense]) + " +" + shieldState.option2.value;
      choices["option2"] = {
        name: shieldState.option2.defense,
        label: label2,
        value: shieldState.option2.value,
      };
    } else {
      choices["option2"] = {
        value: shieldState.other,
        label: shieldState.other,
      };
    }

    const prompt = "E20.SelectShieldPrompt";
    const title = "E20.SelectShieldTitle";

    new ChoicesPrompt(choices, currentShield, actor, prompt, title, stateString).render(true);
    return;
  }

  if (shieldState.type == "defenseBonusCombo") {
    const shieldString = `system.defenses.${shieldState.option2.defense}.shield`;
    await actor.update({
      [shieldString] : shieldState.option2.value,
    });
  }

  if (stateString == "activeEffect") {
    currentShield.update({
      ["system.active"] : true,
    });
  } else {
    currentShield.update({
      ["system.active"] : false,
    });
  }
}

/**
 * Handles the setting of options selected by the Choice Prompt.
 * @param {Actor} actor The actor with the shield.
 * @param {Shield} shield The shield that is changing state.
 * @param {String} state Whether we are going to active or passive.
 * @param {Integer} value The bonus amount.
 * @param {String} defense The defense that the bonus is being added to.
 */
export async function setShieldOptions(actor, shield, state, value=null, defense=null) {
  if (defense) {
    const updateString = `system.defenses.${defense}.shield`;
    actor.update({
      [updateString] : value,
    });
  }

  shield.update({
    ["system.active"] : state == "activeEffect",
  });
}
