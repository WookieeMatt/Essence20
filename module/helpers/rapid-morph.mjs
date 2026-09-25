import { onMorph } from "../sheet-handlers/power-ranger-handler.mjs";

/**
 * Rapid Morph (A Jump Through Time, Ranger Operator [Form] Grid Power, p.60): "By expending 1
 * Personal Power while interacting with your Morpher, you assume your Morphed form as a Free
 * action that does not require the verbal activation phrase."
 *
 * The Power cost is already spent generically by sheet-handlers/power-handler.mjs before this ever
 * runs (see helpers/power-use.mjs#onPowerUse's own doc comment) - this only needed to actually
 * DO the morph, which the compendium item's own bare "power" schema had no way to trigger before.
 * Reuses sheet-handlers/power-ranger-handler.mjs#onMorph directly (the same Boosted Vigor/Growth
 * Boost/image-swap side effects a normal Morph gets - RAW only waives the verbal phrase and action
 * cost, not any of Morphing's other consequences), rather than It's Time's own bare isMorphed flip
 * (see helpers/its-time.mjs's own doc comment for why THAT Perk bypasses onMorph - it doesn't apply
 * here, since this actor has an ordinary Morph of their own).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the actor was actually morphed (false if already Morphed -
 *   RAW's own "assume your Morphed form" has nothing left to do at that point).
 */
export async function activateRapidMorph(actor) {
  if (actor.system.isMorphed) {
    return false;
  }

  await onMorph(actor);
  return true;
}
