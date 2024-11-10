/**
 * Handle morphing an Actor
 * @param {ActorSheet} actorSheet The ActorSheet for the Actor being Morphed
 */
export async function onMorph(actorSheet) {
    await actorSheet.actor.update({
      "system.isMorphed": !actorSheet.actor.system.isMorphed,
    }).then(actorSheet.render(false));
  }
