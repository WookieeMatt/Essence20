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
 * Create a new Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to create the AE
 * @param {Document} owner The item or actor that the AE is created on.
 * @param {HTMLElement} target The element carrying data-action (see this function's own doc
 *   comment on onEditActiveEffect below for why this - not event.target - is what carries the
 *   dataset this needs).
 * @returns
 */
export function onCreateActiveEffect(event, owner, target) {
  event.preventDefault();
  const data = target.dataset;

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
 * Delete an Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to delete the AE
 * @param {Document} owner The item or actor that the AE is deleted on.
 * @param {HTMLElement} target The element carrying data-action (see onEditActiveEffect below).
 * @returns
 */
export async function onDeleteActiveEffect(event, owner, target) {
  event.preventDefault();
  const data = target.dataset;
  if (checkIsLocked(owner)) {
    return;
  }

  const result = await owner.effects.get(data.key);
  if (result) {
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
 * Edit an Active Effect on an actor or item.
 * @param {MouseEvent} event The click event to edit the AE
 * @param {Document} owner The item or actor that the AE is on.
 * @param {HTMLElement} target The element carrying data-action (effects.hbs's own <a
 *   data-action="editEffect">, not the decorative <i> icon inside it that data-uuid used to live
 *   on) - event.target is whichever specific descendant the pointer was actually over, which for
 *   a click that lands on the <a>'s own padding rather than squarely on its icon is the <a>
 *   itself, carrying no dataset of its own. ApplicationV2's own action dispatch already resolves
 *   this correctly for every action handler (see e.g. item-sheet.mjs's #editDescription) - it's
 *   passed as this second parameter, already `closest("[data-action]")`-walked up from wherever
 *   was actually clicked, so this stays correct regardless of which sub-pixel of the control the
 *   click landed on.
 * @returns
 */
export async function onEditActiveEffect(event, owner, target) {
  event.preventDefault();
  const data = target.dataset;
  if (checkIsLocked(owner)) {
    return;
  }

  const effect = await fromUuid(data.uuid);
  if (effect) {
    effect.sheet.render(true);
  }
}

/**
 * Toggles an Active Effect on an actor or item from Inactive to Active.
 * @param {MouseEvent} event The click event to toggle the AE
 * @param {HTMLElement} target The element carrying data-action (see onEditActiveEffect above).
 * @returns
 */
export async function onToggleActiveEffect(event, target) {
  event.preventDefault();
  const data = target.dataset;

  const effect = await fromUuid(data.uuid);
  if (effect) {
    return effect.update({disabled: !effect.disabled});
  }
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
  for (const effect of effects) {
    if (effect.disabled) categories.inactive.effects.push(effect);
    else if (effect.isTemporary) categories.temporary.effects.push(effect);
    else categories.passive.effects.push(effect);
  }

  return categories;
}

/* -------------------------------------------- */

/**
 * Create a hotbar Macro which toggles an Active Effect on and off.
 *
 * The companion to createItemMacro (essence20.mjs) for the other document type the hotbarDrop
 * hook claims: dropping an effect previously did nothing at all, because createItemMacro returns
 * early for anything that is not an Item while the hook had already returned false and suppressed
 * Foundry's own handling.
 * @param {object} data The drop data for the dragged ActiveEffect
 * @param {number} slot The hotbar slot to assign the macro to
 * @returns {Promise<boolean>}
 */
export async function createEffectMacro(data, slot) {
  if (data.type !== "ActiveEffect") return false;

  if (!("uuid" in data)) {
    ui.notifications.warn(game.i18n.localize("E20.EffectMacroUnowned"));
    return false;
  }

  const effect = await fromUuid(data.uuid);
  if (!effect) return false;

  // Keyed on id + name rather than uuid, matching createItemMacro: the macro resolves against
  // whichever Actor the user currently controls, so one macro works for every token that carries
  // an effect of that name instead of being pinned to the single document that was dragged.
  const command = `game.essence20.toggleEffectMacro("${effect.id}", "${effect.name}");`;
  let macro = game.macros.find(m => m.name === effect.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: effect.name,
      type: "script",
      img: effect.img || "icons/svg/aura.svg",
      command,
      flags: { "essence20.effectMacro": true },
    });
  }

  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/* -------------------------------------------- */

/**
 * Toggle an Active Effect on the controlled Actor, for a macro made by createEffectMacro.
 * @param {string} effectId The id of the effect as it was when dragged
 * @param {string} effectName The effect's name, used when the id no longer resolves
 * @returns {Promise|void}
 */
export function toggleEffectMacro(effectId, effectName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);

  // allApplicableEffects() covers effects granted by owned Items as well as the Actor's own, which
  // is what the sheet's Effects tab lists - the guard mirrors skill-effects.mjs, for actor-likes
  // that predate it. Falling back to the name keeps a macro working after the effect is deleted
  // and recreated, or when it is used by a different character than the one it was dragged from.
  const effects = actor
    ? (actor.allApplicableEffects ? [...actor.allApplicableEffects()] : [...(actor.effects ?? [])])
    : [];
  const effect = effects.find(e => e.id === effectId) ?? effects.find(e => e.name === effectName);

  if (!effect) {
    return ui.notifications.warn(
      game.i18n.format("E20.EffectMacroMissing", { name: effectName }),
    );
  }

  return effect.update({ disabled: !effect.disabled });
}
