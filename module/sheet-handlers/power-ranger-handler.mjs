import { checkIsLocked } from "../helpers/actor.mjs";
import { _getItemDeleteConfirmDialog } from "./listener-item-handler.mjs";

/**
 * Prepare Zords for MFZs.
 * @param {Actor} actor The Megaform Zord to prepare Zords for
 * @param {Object} context The actor data to prepare
*/
export function prepareSystemActors(actor, context) {
  if (Object.keys(actor.system.actors).length > 0) {
    const actors = [];

    for (const [ , embeddedActor] of Object.entries(actor.system.actors)) {
      actors.push(fromUuidSync(embeddedActor.uuid));
    }

    context.actors = actors;
  }
}

/**
 * Handle deleting Zords from MFZs
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose Zord is being deleted
 */
export async function onSystemActorsDelete(event, actorSheet) {
  const actor = actorSheet.actor;
  if (checkIsLocked(actor)) {
    return;
  }

  const li = $(event.currentTarget).closest(".systemActors");
  const systemActorsId = li.data("systemActorsUuid");

  // return if no item is found.
  if (!systemActorsId) {
    return;
  }

  // Confirmation dialog
  const confirmation = await _getItemDeleteConfirmDialog(actor);
  if (confirmation.cancelled) {
    return;
  }

  let keyId = null;

  for (const [ key , embeddedActor] of Object.entries(actor.system.actors)) {
    if (embeddedActor.uuid == systemActorsId) {
      keyId = key;
      break;
    }
  }

  const updateString = `system.actors.-=${keyId}`;

  await actor.update({[updateString]: null});
  li.slideUp(200, () => actorSheet.render(false));
}

/**
 * Handle morphing an Actor
 * @param {ActorSheet} actorSheet The ActorSheet for the Actor being Morphed
 */
export async function onMorph(actorSheet) {
  await actorSheet.actor.update({
    "system.isMorphed": !actorSheet.actor.system.isMorphed,
  }).then(actorSheet.render(false));
}
