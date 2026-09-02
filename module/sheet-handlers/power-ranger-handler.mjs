import { changeTokenImage } from "../helpers/actor.mjs";
import { activatePowerInfusion } from "../helpers/power-infusion.mjs";

/**
 * Handles the "Activate" button on a granted Power Infusion Perk (PR CRB p.41) - see
 * helpers/power-infusion.mjs for the actual activation logic.
 * @param {Event} event   The originating click event.
 */
export async function onActivatePowerInfusion(event) {
  const item = await fromUuid(event.target.dataset.uuid);
  if (!item?.parent) {
    return;
  }

  await activatePowerInfusion(item.parent);
}

/**
 * Handle morphing an Actor
 * @param {Actor} actor The Actor being Morphed
 */
export async function onMorph(actor) {
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
  });
}
