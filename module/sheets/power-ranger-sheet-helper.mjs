/**
 * Prepare Zords for MFZs.
 *
 * @param {Object} context                 The actor data to prepare
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export function prepareZords(context, actorSheet) {
  const actor = actorSheet.actor;
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
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function onZordDelete(event, actorSheet) {
  const actor = actorSheet.actor;
  const li = $(event.currentTarget).parents(".zord");
  const zordId = li.data("zordId");
  const zordIds = actor.system.zordIds.filter(x => x !== zordId);
  actor.update({ "system.zordIds": zordIds });
  li.slideUp(200, () => actorSheet.render(false));
}

/**
 * Handle morphing an Actor
 * @param {Essence20ActorSheet} actorSheet The actor sheet
 */
export async function onMorph(actorSheet) {
  const actor = actorSheet.actor;
  await actor.update({
    "system.isMorphed": !actor.system.isMorphed,
  }).then(actorSheet.render(false));
}
