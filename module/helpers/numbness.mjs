import { ENERGY_DAMAGE_TYPES, getEffectiveLevel } from "./combat.mjs";
import { findPerk } from "./perks.mjs";

export const NUMBNESS_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.HB7e3uW1ggYNJVql";
export const STONE_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.QlFNI9fQZXqO5N2J";

/**
 * Numbness (Finster's Monster-Matic Cookbook, Path of Stone, 1st level, p.294) - Table 5-5's own
 * "Numbness" column grants a GROWING list of damage-type Resistances as the actor levels: Stun at
 * 1st, +Psychic at 6th, +Blunt at 12th, +Energy at 18th. Stone Warlord (20th level, p.297) adds one
 * more, player-chosen type on top ("Add an additional Damage type to your Numbness list" - RAW
 * names no specific type), via the new `stoneWarlordDamageType` choiceType.
 * @param {Actor} actor
 * @returns {String[]}
 */
export function getNumbnessDamageTypes(actor) {
  if (!findPerk(actor, NUMBNESS_ID)) {
    return [];
  }

  const level = getEffectiveLevel(actor);
  const types = [];
  if (level >= 1) {
    types.push('stun');
  }

  if (level >= 6) {
    types.push('psychic');
  }

  if (level >= 12) {
    types.push('blunt');
  }

  if (level >= 18) {
    types.push('energy');
  }

  const stoneWarlordChoice = findPerk(actor, STONE_WARLORD_ID)?.system.choice;
  if (stoneWarlordChoice) {
    types.push(stoneWarlordChoice);
  }

  return types;
}

/**
 * "Energy" in Numbness's own list is this book's own display term for the same Element/Energy
 * equivalence group helpers/combat.mjs#ENERGY_DAMAGE_TYPES already tracks (per the user's own
 * "treat Energy and Element as the same between games" ruling) - a concrete sub-type like 'fire'
 * or 'electric' matches it, not just the literal string 'energy'.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasNumbnessResistance(actor, damageType) {
  if (!damageType) {
    return false;
  }

  const types = getNumbnessDamageTypes(actor);
  if (types.includes(damageType)) {
    return true;
  }

  return types.includes('energy') && ENERGY_DAMAGE_TYPES.has(damageType);
}
