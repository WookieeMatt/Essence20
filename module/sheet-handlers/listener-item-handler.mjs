import { checkIsLocked } from "../helpers/actor.mjs";
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
    if (item.type == "armor") {
      deleteAttachmentsForItem(item, actor);
    } else if (item.type == "origin") {
      onOriginDelete(actor, item);
    } else if (item.type == 'influence') {
      deleteAttachmentsForItem(item, actor);
    } else if (item.type == "altMode") {
      onAltModeDelete(actorSheet, item);
    } else if (item.type == "alteration") {
      onAlterationDelete(actor, item);
    } else if (item.type == "focus") {
      onFocusDelete(actor, item);
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
      "window-content"
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
    ]
  })

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
