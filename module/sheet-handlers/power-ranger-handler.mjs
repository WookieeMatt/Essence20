import { changeTokenImage } from "../helpers/actor.mjs";
import { activatePowerInfusion } from "../helpers/power-infusion.mjs";
import { applyBoostedVigor } from "../helpers/phantom-focus.mjs";
import { clearPoweredPlating } from "../helpers/powered-plating.mjs";
import { applyGrowthBoostHealth } from "../helpers/growth-boost.mjs";
import { deactivateMysteriousAura } from "../helpers/mysterious-aura.mjs";

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

  // Boosted Vigor (Across the Stars, Phantom Ranger, Phantom Focus choice, p.62) - see
  // helpers/phantom-focus.mjs's own doc comment. Applied right here, before isMorphed itself
  // flips, so isAboutToMorph reflects the state actually being entered.
  await applyBoostedVigor(actor, !actor.system.isMorphed);

  // Growth Boost (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33) - see
  // helpers/growth-boost.mjs's own doc comment. Same Morph-time toggle shape as Boosted Vigor
  // just above.
  await applyGrowthBoostHealth(actor, !actor.system.isMorphed);

  // Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32) - "until
  // you are no longer Morphed" - cleared right here on the way OUT of Morphed (actor.system.isMorphed
  // still true means this call is about to un-Morph them), no refund.
  if (actor.system.isMorphed) {
    await clearPoweredPlating(actor);
  }

  // Mysterious Aura (A Jump Through Time, White Spectrum Modification, replaces Follow Me!,
  // p.45) - "until you de-Morph" - same "clear on the way OUT of Morphed" idiom as Powered
  // Plating just above.
  if (actor.system.isMorphed) {
    await deactivateMysteriousAura(actor);
  }

  await actor.update({
    "system.isMorphed": !actor.system.isMorphed,
  });
}
