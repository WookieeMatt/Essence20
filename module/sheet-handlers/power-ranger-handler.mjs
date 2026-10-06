import { changeTokenImage } from "../mechanics/world/token-sync.mjs";
import { payForMorph, warnMissingStateImage } from "../mechanics/characters/morph-state.mjs";
import { activatePowerInfusion } from "../items/rolls/power-infusion.mjs";
import { applyBoostedVigor } from "../items/healing/phantom-focus.mjs";
import { clearPoweredPlating } from "../items/defenses/powered-plating.mjs";
import { applyGrowthBoostHealth } from "../items/healing/growth-boost.mjs";
import { deactivateMysteriousAura } from "../items/defenses/mysterious-aura.mjs";
import { clearEmotionalMasteryOnMorphOff } from "../items/resources/emotional-mastery.mjs";

/**
 * Handles the "Activate" button on a granted Power Infusion Perk (PR CRB p.41) - see
 * items/rolls/power-infusion.mjs for the actual activation logic.
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
 * @param {Object} [options]
 * @param {Boolean} [options.free]   Already paid for by whatever triggered it (Rapid Morph's Free action).
 */
export async function onMorph(actor, { free = false } = {}) {
  // Morphing in takes a Standard action (a Move with a Rev Morpher) - see morph-state.mjs.
  if (!actor.system.isMorphed && !free && !(await payForMorph(actor))) {
    return;
  }

  let newImage = null;
  if (actor.system.isMorphed) {
    newImage = actor.system.image.unmorphed;
  } else {
    // The swap below is silent when no Morphed art was ever set - say so, once, on the way in.
    warnMissingStateImage(actor, "morph");
    await actor.update ({
      "system.image.unmorphed": actor.prototypeToken.texture.src,
    });
    newImage = actor.system.image.morphed;
  }

  changeTokenImage(actor, newImage);

  // Boosted Vigor (Across the Stars, Phantom Ranger, Phantom Focus choice, p.62) - see
  // items/healing/phantom-focus.mjs's own doc comment. Applied right here, before isMorphed itself
  // flips, so isAboutToMorph reflects the state actually being entered.
  await applyBoostedVigor(actor, !actor.system.isMorphed);

  // Growth Boost (A Jump Through Time, Orange Ranger, Modified Shell III option, p.33) - see
  // items/healing/growth-boost.mjs's own doc comment. Same Morph-time toggle shape as Boosted Vigor
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

  // Emotional Mastery (A Jump Through Time, Purple Ranger, p.37) - see
  // items/resources/emotional-mastery.mjs's own doc comment. Same "clear on the way OUT of Morphed" idiom
  // as Powered Plating/Mysterious Aura just above, except a Heart's Calling option (18th level)
  // is deliberately kept active, per its own "works even when you are not Morphed" text.
  if (actor.system.isMorphed) {
    await clearEmotionalMasteryOnMorphOff(actor);
  }

  await actor.update({
    "system.isMorphed": !actor.system.isMorphed,
  });
}
