import { bankPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Bio-Energy Conversion (Across the Stars, Zord Feature, p.72; prerequisite: Dino Gem Integration
 * Feature - left GM-enforced, same convention every other build-time Zord Feature prerequisite in
 * this codebase already accepts, e.g. Titan Body's own doc comment): "As a Standard action, you
 * may harness bio-energy from the surrounding environment. On your next turn, gain ↑2 on Attack
 * Skill Tests and inflict 2 extra damage on all attacks (both melee and ranged)."
 *
 * A single-round-delayed buff: banked on the round it's used, active only on the very next combat
 * round (the same round the Zord's own next turn falls on, since each combatant acts once per
 * round) - see isBioEnergyConversionActive() below. It self-expires the round after that with no
 * explicit clear needed, the same "round equality alone gates it" shape bankPendingBonus's own
 * round-stamping already provides elsewhere in this file.
 */
export const BIO_ENERGY_CONVERSION_ID = "Compendium.essence20.across_the_stars.Item.W1fwCDu7FOmg0yaQ";
const BIO_ENERGY_CONVERSION_FLAG = 'bioEnergyConversionPending';

/**
 * @param {Actor} actor
 * @returns {Boolean}   Always usable - it's a Standard action with no other gate, RAW places no
 *   once-per-scene/day cap on it (only the action cost, already enforced by action-economy.mjs).
 */
export function canUseBioEnergyConversion() {
  return true;
}

/**
 * @param {Actor} actor
 */
export async function activateBioEnergyConversion(actor) {
  await bankPendingBonus(actor, BIO_ENERGY_CONVERSION_FLAG, {});
}

/**
 * @param {Actor} actor
 * @returns {Boolean}   True only during the single combat round right after it was banked.
 */
export function isBioEnergyConversionActive(actor) {
  const pending = getPendingBonus(actor, BIO_ENERGY_CONVERSION_FLAG);
  return !!pending && !!game.combat && pending.round == game.combat.round - 1;
}
