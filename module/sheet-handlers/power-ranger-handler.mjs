import { changeTokenImage } from "../helpers/actor.mjs";

/**
 * Handle morphing an Actor
 * @param {ActorSheet} actorSheet The ActorSheet for the Actor being Morphed
 */
export async function onMorph(actorSheet) {
  const actor = actorSheet.actor;
  let newToken = null;
  if (!actor.system.isMorphed ) {
    await actor.update ({
      "system.image.unmorphed": actor.prototypeToken.texture.src,
    })
    newToken = actor.system.image.morphed;
  } else {
    newToken = actor.system.image.unmorphed;
  }

  changeTokenImage(actor, newToken)

  await actor.update({
    "system.isMorphed": !actor.system.isMorphed,
  }).then(actorSheet.render(false));
}
