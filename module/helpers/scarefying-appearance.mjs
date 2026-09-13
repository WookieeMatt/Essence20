import { E20 } from "./config.mjs";

// Scarefying Appearance (Knights of Canterlot, Virtuoso Enchantment spell, p.51): "you get the
// following benefits: You gain a +2 to the use of the Intimidation Skill. You step up one size
// category." Built as a self-only on/off flag (a target actor could theoretically cast this on
// itself only - Range: Reach - matching every other self-cast spell's flag shape) storing the
// actor's ORIGINAL size so it can be restored exactly on deactivation, the same "save and restore"
// idiom Monster Grow! (helpers/monster-grow.mjs) already established, just stepping ONE size
// category up the E20.actorSizes ladder instead of jumping straight to Gigantic. The +2
// Intimidation shiftUp itself is read directly in dice.mjs#rollSkill, same shape as every other
// self-status shiftUp this project has built.
//
// NOT built (a much larger remaining scope, deliberately deferred): "Threats of the same or
// smaller size categories gain the Frightened condition unless they succeed at a DIF 14
// Intimidation Skill Test" needs the same "every creature in the area rolls their own save" gap
// already confirmed blocking Big Honking Boom/Bellowbreath/Lullaby; "pick two of: +2 Toughness,
// Claws (melee, 2 sharp damage), Wings (and flight), or an additional upshift-1 to Intimidation"
// needs a new "choose 2 of N" picker (this project's existing pickers - Grid Surge, Phantom Focus,
// Power Adaptation - are all pick-ONE).

const SCAREFYING_APPEARANCE_FLAG = 'scarefyingAppearanceOriginalSize';

export function isScarefyingAppearanceActive(actor) {
  return !!actor?.getFlag?.('essence20', SCAREFYING_APPEARANCE_FLAG);
}

export async function applyScarefyingAppearance(actor) {
  if (isScarefyingAppearanceActive(actor)) {
    return;
  }

  const sizeOrder = Object.keys(E20.actorSizes);
  const currentIndex = sizeOrder.indexOf(actor.system.size);
  const nextSize = currentIndex >= 0 && currentIndex < sizeOrder.length - 1
    ? sizeOrder[currentIndex + 1]
    : actor.system.size;

  await actor.setFlag('essence20', SCAREFYING_APPEARANCE_FLAG, actor.system.size);
  await actor.update({ 'system.size': nextSize });
}

export async function removeScarefyingAppearance(actor) {
  const originalSize = actor.getFlag('essence20', SCAREFYING_APPEARANCE_FLAG);
  if (originalSize) {
    await actor.update({ 'system.size': originalSize });
  }
  await actor.unsetFlag('essence20', SCAREFYING_APPEARANCE_FLAG);
}
