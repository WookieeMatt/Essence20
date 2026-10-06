import { hasUsedThisEncounter, markUsedThisEncounter } from "../../mechanics/characters/perks.mjs";

/**
 * A handful of weaponEffect Items are capped independently of any Perk, straight off the weapon's
 * own printed stat line - "Energy Attack: 1/Encounter" (Turbo Thunder Cannon, Across the Stars
 * Table 3-1.1 p.78) or "Once per scene, the Battlizer can also make the following Attack" (Wing
 * Missile Salvo, Falcon Armor Battlizer, Across the Stars p.86). Keyed by the effect Item's own
 * compendium id, not its parent weapon's, since a weapon can carry both an unlimited base profile
 * and a limited alternate one side by side (Turbo Thunder Cannon's base blast is unlimited; only
 * its Energy Attack alternate is capped). Wing Missile Salvo's own two profiles (Blast and
 * Multiple Targets) share a single flag, matching the book's single "once per scene" cap on the
 * whole Attack rather than one cap per profile. Turbo Lightning Sword's Energy Attack carries the
 * same "1/Encounter" line in the same table, and the Power Rangers Core Rulebook reprints both
 * Turbo weapons with the same cap ("1x/ Encounter", Table 8-3.2), so each printing is listed.
 */
const LIMITED_WEAPON_EFFECT_FLAGS = {
  "Compendium.essence20.across_the_stars.Item.Wl7L2wcydXAw9Xei": 'turboThunderCannonEnergyAttackUsedThisEncounter',
  "Compendium.essence20.pr_crb.Item.GkobUXUpyU8l6gKw": 'turboThunderCannonEnergyAttackUsedThisEncounter',
  "Compendium.essence20.across_the_stars.Item.3VBxXY5kXow9UGgX": 'turboLightningSwordEnergyAttackUsedThisEncounter',
  "Compendium.essence20.pr_crb.Item.A2T4cCya4l1rlihY": 'turboLightningSwordEnergyAttackUsedThisEncounter',
  "Compendium.essence20.across_the_stars.Item.Z6cpZMj1nKTquCLF": 'wingMissileSalvoUsedThisEncounter',
  "Compendium.essence20.across_the_stars.Item.FRue0q6oL8aRWswk": 'wingMissileSalvoUsedThisEncounter',
};

/**
 * @param {String} sourceId   The rolled weaponEffect's own flags.core.sourceId/_stats.compendiumSource.
 * @returns {Boolean}   Whether this effect is one of the capped ones at all.
 */
export function isLimitedWeaponEffect(sourceId) {
  return !!LIMITED_WEAPON_EFFECT_FLAGS[sourceId];
}

/**
 * @param {Actor} actor
 * @param {String} sourceId
 * @returns {Boolean}   True for an effect not on the list at all (nothing to gate).
 */
export function canRollLimitedWeaponEffect(actor, sourceId) {
  const flagKey = LIMITED_WEAPON_EFFECT_FLAGS[sourceId];
  return !flagKey || !hasUsedThisEncounter(actor, flagKey);
}

/**
 * Records that a capped weaponEffect was just rolled. A no-op for an effect not on the list.
 * @param {Actor} actor
 * @param {String} sourceId
 */
export async function markLimitedWeaponEffectUsed(actor, sourceId) {
  const flagKey = LIMITED_WEAPON_EFFECT_FLAGS[sourceId];
  if (flagKey) {
    await markUsedThisEncounter(actor, flagKey);
  }
}
