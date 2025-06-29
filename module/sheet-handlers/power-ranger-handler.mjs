import { changeTokenImage } from "../helpers/actor.mjs";

/**
 * Handle morphing an Actor
 * @param {ActorSheet} actorSheet The ActorSheet for the Actor being Morphed
 */
export async function onMorph(actorSheet) {
  const actor = actorSheet.actor;
  let newImage = null;
  if (actor.system.isMorphed) {
    newImage = actor.system.image.unmorphed;
  } else {
    await actor.update ({
      "system.image.unmorphed": actor.prototypeToken.texture.src,
    });
    newImage = actor.system.image.morphed;
  }

  changeTokenImage(actor, newImage);

  await actor.update({
    "system.isMorphed": !actor.system.isMorphed,
  }).then(actorSheet.render(false));
}
