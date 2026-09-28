import { E20 } from "./config.mjs";
import { actorHasPerk } from "./perks.mjs";

/**
 * Fanning (X) (A Jump Through Time, New Weapon Traits, p.74): "may fire up to X Attacks in single
 * Standard action, with the first Attack suffering a ↓1 modifier, increasing to ↓2 on the next".
 * The rest of the trait is built too: the volley stops at the first Fumble, and afterwards the
 * weapon needs a Move action before it fires again (helpers/reload.mjs's own needsReload flag).
 *
 * The player chooses how many shots to fan in the Roll Options Dialog, from 0 (an ordinary
 * attack, no Fanning penalty at all) up to X. X is weapon.system.fanningMagnitude - a numeric
 * field next to the plain trait membership check, the same shape as ongoingDuration/
 * defendMagnitude. Every shot of the volley is its own Attack Skill Test with its own shift,
 * rolled by dice.mjs#rollSkill's repeat loop with a per-shot formula.
 *
 * Storm of Lead (A Jump Through Time, General Perk, p.56): "the X value is +1, and the first
 * Attack receives a ↑1 bonus."
 */
export const STORM_OF_LEAD_ID = "Compendium.essence20.jump_through_time.Item.Px86Wo4MyldPjl5X";

/**
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isFanningWeapon(weapon) {
  return !!weapon?.system?.traits?.includes('fanning');
}

/**
 * The most shots this actor can fan with this weapon: the weapon's own X, plus one for Storm of
 * Lead. A Fanning weapon with no X recorded (a homebrew item) counts as X = 1. 0 for anything that
 * isn't a Fanning weapon at all.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Number}
 */
export function getFanningMaxShots(actor, weapon) {
  if (!isFanningWeapon(weapon)) {
    return 0;
  }

  const magnitude = Math.max(1, Number(weapon.system.fanningMagnitude) || 1);
  return magnitude + (actorHasPerk(actor, STORM_OF_LEAD_ID) ? 1 : 0);
}

/**
 * Clamps whatever the player typed into the dialog to a legal shot count - 0 (not fanning) to max.
 * @param {*} requested
 * @param {Number} maxShots
 * @returns {Number}
 */
export function clampFanningShots(requested, maxShots) {
  const shots = Math.floor(Number(requested) || 0);
  return Math.max(0, Math.min(shots, maxShots || 0));
}

/**
 * The shift modifiers for one shot of the volley (1-based): ↓shotNumber, with Storm of Lead's ↑1
 * on the first shot only.
 * @param {Number} shotNumber
 * @param {Boolean} hasStormOfLead
 * @returns {{shiftUp: Number, shiftDown: Number}}
 */
export function getFanningShotShifts(shotNumber, hasStormOfLead = false) {
  return {
    shiftUp: hasStormOfLead && shotNumber == 1 ? 1 : 0,
    shiftDown: shotNumber,
  };
}

/**
 * Re-applies the post-_getFinalShift adjustments dice.mjs#rollSkill makes to the first shot, for
 * a later shot whose shift was recomputed with its own larger ↓. Same order as there: the
 * Programmable d12 cap, Savant Skill's flat d4, then auto-fail, then auto-success, then Super
 * Specialized's extra step.
 * @param {String} shift   The later shot's shift, straight from _getFinalShift.
 * @param {Object} options
 * @param {Boolean} [options.programmableCapD12]
 * @param {Boolean} [options.savant]
 * @param {Boolean} [options.superSpecialized]
 * @returns {{shift: String, autoFail: Boolean}}   autoFail is true when this shot can't be rolled
 *   at all (an autoFail/fumble shift) - the volley stops there.
 */
export function adjustFanningShotShift(shift, { programmableCapD12 = false, savant = false, superSpecialized = false } = {}) {
  let adjusted = shift;
  if (programmableCapD12) {
    const d12Index = E20.skillShiftList.indexOf('d12');
    const index = E20.skillShiftList.indexOf(adjusted);
    if (index != -1 && index < d12Index) {
      adjusted = 'd12';
    }
  }

  if (savant) {
    adjusted = 'd4';
  }

  if (E20.autoFailShifts.includes(adjusted)) {
    return { shift: adjusted, autoFail: true };
  }

  if (E20.autoSuccessShifts.includes(adjusted)) {
    adjusted = E20.skillRollableShifts[E20.skillRollableShifts.length - 1];
  }

  if (superSpecialized) {
    const index = E20.skillShiftList.indexOf(adjusted);
    if (index > 0) {
      adjusted = E20.skillShiftList[index - 1];
    }
  }

  return { shift: adjusted, autoFail: false };
}
