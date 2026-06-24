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

export function onCreateActiveEffect(event,owner) {
  event.preventDefault();
  const data = event.target.dataset

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

export async function onDeleteActiveEffect(event, owner) {
  event.preventDefault();
  const data = event.target.dataset

  if (checkIsLocked(owner)) {
    return;
  }

  const result = await owner.effects.get(data.key)

  console.log(result)
  if (result) {

  }
}

export async function onEditActiveEffect(event, owner) {
  event.preventDefault();
  const data = event.target.dataset

  if (checkIsLocked(owner)) {
    return;
  }

  const item = await fromUuid(data.uuid);

  if (item) {
    item.sheet.render(true);
  }

}

export function onToggleActiveEffect(event, owner) {

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
