/**
 * Prepare Zords for MFZs.
 * @param {Actor} actor The Megaform Zord to prepare Zords for
 * @param {Object} context The actor data to prepare
 */
export function prepareZords(actor, context) {
  if (actor.type == 'megaformZord') {
    let zords = [];

    for (let zordId of actor.system.zordIds) {
      zords.push(game.actors.get(zordId));
    }

    context.zords = zords;
  }
}

/**
 * Handle deleting Zords from MFZs
 * @param {Event} event The originating click event
 * @param {ActorSheet} actorSheet The ActorSheet whose Zord is being deleted
 */
export async function onZordDelete(event, actorSheet) {
  const li = $(event.currentTarget).parents(".zord");
  const zordId = li.data("zordId");
  const zordIds = actorSheet.actor.system.zordIds.filter(x => x !== zordId);
  actorSheet.actor.update({ "system.zordIds": zordIds });
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
