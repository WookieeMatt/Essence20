/**
 * Prepare Zords for MFZs.
 * @param {Actor} actor The Megaform Zord to prepare Zords for
 * @param {Object} context The actor data to prepare
 */
export async function prepareZords(actor, context) {
  if(actor.system.passengers) {
    let zords = [];

    for (const [, zord] of Object.entries(actor.system.passengers)) {
      zords.push(await fromUuid(zord.uuid));
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
  const id = li.data("zordKey");
  const updateString = `system.passengers.-=${id}`;
  console.log(updateString)

  await actorSheet.actor.update({[updateString]: null});
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
