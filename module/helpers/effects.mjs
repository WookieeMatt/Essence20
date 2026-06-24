import { checkIsLocked } from "../helpers/actor.mjs";

/**
 * Manage Active Effect instances through the Actor Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
export function onManageActiveEffect(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;

  if (["create", "delete"].includes(a.dataset.action) && checkIsLocked(owner)) {
    return;
  }

  const li = a.closest("li");
  const effect = li.dataset.effectId ? owner.effects.get(li.dataset.effectId) : null;
  switch ( a.dataset.action ) {
  case "create":
    return owner.createEmbeddedDocuments("ActiveEffect", [{
      name: "New Effect",
      img: "icons/svg/aura.svg",
      origin: owner.uuid,
      "duration.rounds": li.dataset.effectType === "temporary" ? 1 : undefined,
      disabled: li.dataset.effectType === "inactive",
    }]);
  case "edit":
    return effect.sheet.render(true);
  case "delete":
    return effect.delete();
  case "toggle":
    return effect.update({disabled: !effect.disabled});
  }
}

/**
 *Create a new Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to create the AE
 * @param {Document} owner The item or actor that the AE is created on.
 * @returns
 */
export function onCreateActiveEffect(event,owner) {
  event.preventDefault();
  const data = event.target.dataset;

  if (checkIsLocked(owner)) {
    return;
  }

  return owner.createEmbeddedDocuments("ActiveEffect", [{
    name: "New Effect",
    img: "icons/svg/aura.svg",
    origin: owner.uuid,
    "duration.rounds": data.effectType === "temporary" ? 1 : undefined,
    disabled: data.effectType === "inactive",
  }]);

}

/**
 *Delete an Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to delete the AE
 * @param {Document} owner The item or actor that the AE is deleted on.
 * @returns
 */
export async function onDeleteActiveEffect(event, owner) {
  event.preventDefault();
  const data = event.target.dataset;
  if (checkIsLocked(owner)) {
    return;
  }

  const result = await owner.effects.get(data.key);
  if(result) {
    result.delete();
  }
}

/**
 * Allows dropping of Active Effects on Items
 * @param {ActiveEffect} droppedItem The Active Effect being dropped
 * @param {Item} targetItem The item the Active Effect is being dropped on
 */
export async function onDropActiveEffect(droppedItem, targetItem) {
  await targetItem.createEmbeddedDocuments("ActiveEffect", [{
    description: droppedItem.description,
    name: droppedItem.name,
    img: droppedItem.img,
    system: droppedItem.system,
  }]);
}

/**
 *Edit an Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to edit the AE
 * @param {Document} owner The item or actor that the AE is on.
 * @returns
 */
export async function onEditActiveEffect(event, owner) {
  event.preventDefault();
  const data = event.target.dataset;
  if (checkIsLocked(owner)) {
    return;
  }

  const effect = await fromUuid(data.uuid);
  if (effect) {
    effect.sheet.render(true);
  }

}

/**
 *Toggles an Active Effect on an actor or item from Inactive to Active.
 * @param {MouseEvent} event The click event to toggle the AE
 * @param {Document} owner The item or actor that the AE is on.
 * @returns
 */
export async function onToggleActiveEffect(event) {
  event.preventDefault();
  const data = event.target.dataset

  const effect = await fromUuid(data.uuid);
  return effect.update({disabled: !effect.disabled});
}

/**
 * Prepare the data structure for Active Effects which are currently applied to an Actor or Item.
 * @param {ActiveEffect[]} effects    The array of Active Effect instances to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {

  // Define effect header categories
  const categories = {
    temporary: {
      type: "temporary",
      name: "Temporary Effects",
      effects: [],
    },
    passive: {
      type: "passive",
      name: "Passive Effects",
      effects: [],
    },
    inactive: {
      type: "inactive",
      name: "Inactive Effects",
      effects: [],
    },
  };

  // Iterate over active effects, classifying them into categories
  for ( const effect of effects ) {
    if ( effect.disabled ) categories.inactive.effects.push(effect);
    else if ( effect.isTemporary ) categories.temporary.effects.push(effect);
    else categories.passive.effects.push(effect);
  }

  return categories;
}
