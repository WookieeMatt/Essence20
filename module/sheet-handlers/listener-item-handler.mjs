import ChoicesSelector from "../apps/choices-selector.mjs";
import { checkIsLocked } from "../helpers/actor.mjs";
import { onPerkUse } from "../helpers/banked-buffs.mjs";
import { onAlterationDelete } from "./alteration-handler.mjs";
import { deleteAttachmentsForItem, setEntryAndAddItem } from "./attachment-handler.mjs";
import { onOriginDelete } from "./background-handler.mjs";
import { onPerkDelete } from "./perk-handler.mjs";
import { onFocusDelete, onRoleDelete } from "./role-handler.mjs";
import { onAltModeDelete } from "./transformer-handler.mjs";
import { onFactionDelete } from "./faction-handler.mjs";

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

  const header = event.target;
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

  if (type == 'perk') {
    // Each Perk type has its own add button, so handle that
    itemData.system.type = data.perkType;
    delete itemData.system.perkType;
  } else {
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system.type;
  }

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
    } else if (newItem.type == 'weaponEffect' && (parentItem.type == 'weapon' || parentItem.type == 'shield')) {
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
export async function onItemEdit(event) {
  event.preventDefault();
  let item = {};
  const itemUuid = event.target.dataset.uuid;

  if (itemUuid) {
    item = await fromUuid(itemUuid);
    if (!item) {
      ui.notifications.error(
        game.i18n.format("E20.ItemEditErrorBadUuid", {itemUuid}),
      );
    } else {
      item.sheet.render(true);
    }
  }
}

/**
 * Handles the sheet's "Use" control on a bankable Perk (Think On It, Plan of Action - see
 * helpers/banked-buffs.mjs for the full registry and what "Use" actually does for each).
 *
 * Takes the matched [data-action] element directly, NOT the originating click event - Foundry's
 * own ApplicationV2 action dispatcher (#onClickAction in its core code) invokes a registered
 * action handler as `handler.call(this, event, target)`, where `target` is the specific element
 * that carried `data-action`/`data-id` (found via `event.target.closest("[data-action]")`).
 * `event.currentTarget` is never reassigned to that element - it stays whatever the click
 * listener itself is bound to (the sheet's own root), which has no `data-id` of its own. Reading
 * `event.currentTarget.dataset.id` here (as this used to) always resolved to `undefined`, so
 * `actorSheet.actor.items.get(undefined)` always returned nothing and every "Use" button on every
 * Perk sheet-wide silently no-op'd on a real click - masked in this project's own development
 * because every prior live-verification pass called banked-buffs.mjs's onPerkUse() directly,
 * bypassing the sheet's click handling entirely, rather than actually clicking the button.
 * @param {HTMLElement} target The clicked "Use" control itself (its own `data-id` names the Perk).
 * @param {ActorSheet} actorSheet The ActorSheet the Perk is attached to
 */
export async function onPerkUseClick(target, actorSheet) {
  const itemId = target.dataset.id;
  const item = actorSheet.actor.items.get(itemId);
  if (item) {
    await onPerkUse(item);
  }
}

/**
 * Handle deleting Items
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet the Item is being deleted on
 */
export async function onItemDelete(event, actorSheet) {
  const actor = actorSheet.document;
  if (checkIsLocked(actor)) {
    return;
  }

  let item = null;
  const li = $(event.target).closest(".item");
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
    // A plain key (no "-=" prefix - that's the old, now-deprecated deletion syntax, which
    // Foundry v14 logs a compatibility warning for and won't actually apply) paired with
    // ForcedDeletion as the value is what actually deletes it - see item-sheet.mjs's own
    // _onObjectDelete.
    const updateString = `system.items.${id}`;

    await parentItem.update({[updateString]: new foundry.data.operators.ForcedDeletion()});

    item.delete();
    li.slideUp(200, () => actorSheet.render(false));
  } else {
    if (item.type == "alteration") {
      onAlterationDelete(actor, item);
    } else if (item.type == "altMode") {
      onAltModeDelete(actorSheet, item);
    } else if (item.type == "armor") {
      deleteAttachmentsForItem(item, actor);
    } else if (item.type == "faction") {
      onFactionDelete(item, actor);
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
 * Handle inline-editing a field on an owned Item, or (for a Specialization row - see
 * essence20-specialization-redesign) a field inside system.skills.<skill>.specializations.
 * @param {Actor} actor The Actor editing the Item
 * @param {Event} event The originating click event
 */
export async function onInlineEdit(event, actor) {
  event.preventDefault();

  let item;
  let element = event.target;
  const dataset = element.closest(".item").dataset;
  const newValue = element.type == 'checkbox' ? element.checked : element.value;
  const field = element.dataset.field;

  // A Specialization is no longer its own Item - it's a plain object keyed under its skill (see
  // sheet-handlers/specialization-handler.mjs), so it's identified by skill+key instead of the
  // itemId/itemUuid pair below.
  if (dataset.skill && dataset.specializationKey) {
    const path = `system.skills.${dataset.skill}.specializations.${dataset.specializationKey}.${field}`;
    return actor.update({ [path]: newValue });
  }

  const itemId = dataset.itemId;
  const itemUuid = dataset.itemUuid;
  const parentId = dataset.parentId;

  // If a child item is being updated, update the parent's copy too
  if (!itemId && itemUuid && parentId) {
    item = await fromUuid(itemUuid);

    const parentItem = actor.items.get(parentId);
    const parentField = element.dataset.parentField;
    await parentItem.update({ [parentField]: newValue });
  } else {
    item = actor.items.get(itemId);
  }

  return item.update({ [field]: newValue });
}

/**
 * Handles activating and deactivating the shield
 *
 * Takes the matched [data-action] element directly, NOT the originating click event - see
 * onPerkUseClick's own doc comment above for why event.currentTarget (what this used to read)
 * always resolves to the sheet's own root rather than the specific clicked control, and silently
 * (here, not so silently - see below) breaks the lookup this needs.
 * @param {HTMLElement} target The clicked shield-activation control (its own `data-id` names the shield).
 * @param {ActorSheet} actorSheet The ActorSheet that the shield is attached to.
 */
export async function onShieldActivationToggle(target, actorSheet) {
  const actor = actorSheet.actor;
  const shields = await actor.items.documentsByType.shield;
  let currentShield = null;
  for (const shield of shields) {
    if (shield._id == target.dataset.id) {
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
  await shieldUpdate(actor, currentShield, stateString);
}

/**
 * Handles equipping a shield
 *
 * Takes the matched [data-action] element directly, NOT the originating click event - see
 * onShieldActivationToggle's own doc comment above.
 * @param {HTMLElement} target The clicked shield-equip checkbox (its own `data-id` names the shield).
 * @param {ActorSheet} actorSheet The ActorSheet that the shield is being equipped or unequipped on
 */
export async function onShieldEquipToggle(target, actorSheet) {
  const actor = actorSheet.actor;
  const shields = await actor.items.documentsByType.shield;
  let currentShield = null;
  for (const shield of shields) {
    if (shield._id == target.dataset.id) {
      currentShield = shield;
    }
  }

  if (target.checked) {
    await shieldUpdate(actor, currentShield, 'passiveEffect');
  } else {
    for (const defenseType of Object.keys(CONFIG.E20.defenses)) {
      const shieldString = `system.defenses.${defenseType}.shield`;
      await actor.update({
        [shieldString] : 0,
      });
    }

    // Unequipping while active drops the shield's own Cover grant too (see
    // maybeToggleCoverShieldStatus's own doc comment) - shieldUpdate isn't called on this branch
    // at all, so nothing else would ever turn it back off.
    if (currentShield.system.active) {
      await maybeToggleCoverShieldStatus(actor, currentShield, false);
    }

    await currentShield.update({
      ["system.active"]: false,
    });
  }
}

/**
 * Portable Wall (Cobra Codex, Restricted shield, p.98): "Active Effect: Cover" - the only shield
 * in this system whose activeEffect is a named status rather than a numeric Defense bonus
 * (E20.shieldEffectTypes.other, "1 Other Bonus"); shieldUpdate's own defenseBonus/
 * defenseBonusCombo/defenseBonusOption/defenseBonusMixed branches all leave an 'other'-typed
 * effect doing nothing but flipping system.active. Toggles the real Cover status (already
 * mechanically enforced - see dice.mjs's own targetStatuses.has('cover') check) to match whenever
 * the shield's activeEffect names it, so activating/deactivating a Portable Wall actually applies
 * Cover. Only recognizes the literal text "Cover" - every other shield's own 'other' text in this
 * system today is flavor-only (e.g. a Repulsor's traits, which live on `traits` instead), so
 * anything else is left alone rather than guessed at.
 * @param {Actor} actor
 * @param {Item} shield
 * @param {Boolean} becomingActive   Whether the shield's activeEffect is the state being entered.
 */
async function maybeToggleCoverShieldStatus(actor, shield, becomingActive) {
  const activeEffect = shield.system.activeEffect;
  if (activeEffect?.type == 'other' && activeEffect.other?.trim().toLowerCase() == 'cover') {
    await actor.toggleStatusEffect?.('cover', { active: becomingActive });
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

  // See maybeToggleCoverShieldStatus's own doc comment. Keyed off the shield's activeEffect
  // specifically (not `shieldState`, which is whichever state is being ENTERED) so this fires the
  // same way switching either direction: Cover turns on moving into activeEffect, off moving back
  // to passiveEffect.
  await maybeToggleCoverShieldStatus(actor, currentShield, stateString == 'activeEffect');

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

    new ChoicesSelector(choices, actor, prompt, title, currentShield, null, null, stateString, null, null).render(true);
    return;
  }

  if (shieldState.type == "defenseBonusCombo") {
    const shieldString = `system.defenses.${shieldState.option2.defense}.shield`;
    await actor.update({
      [shieldString] : shieldState.option2.value,
    });
  }

  if (stateString == "activeEffect") {
    await currentShield.update({
      ["system.active"] : true,
    });
  } else {
    await currentShield.update({
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
    await actor.update({
      [updateString] : value,
    });
  }

  await shield.update({
    ["system.active"] : state == "activeEffect",
  });
}
