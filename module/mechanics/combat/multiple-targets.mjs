import { isVolleyActive } from "../../items/attacks/volley.mjs";

/**
 * Multiple Targets (X, range/area) (p.198) - see dice.mjs#rollSkill's own doc comment (near its
 * own isMultipleTargetsAttack local) for the full Blast/AoE distinction. Extracted out of
 * dice.mjs itself once a second, non-roll-pipeline consumer showed up: No Need to Aim
 * (its BeforeRoll rule, through check:multipleTargetsWeapon) checks this before the roll's dialog, not from
 * inside dice.mjs the way Trigger Happy/Gallantry/the independent-roll dispatch itself do.
 */

// (Charge Into Battle's Multiple Targets (2) on a Melee Power Weapon is a MultipleTargets rule on the Perk - a real trait
// grant, so every consumer of this function sees it.)

// (Metallikato's Bot Mode melee Multiple Targets, switched on and off by its Use rules, is a MultipleTargets rule on the
// Perk.)

// Extension grants of the Multiple Targets trait, fn(actor, item) => Boolean (Plow -
// helpers/extensions/situational2).
export const MULTIPLE_TARGETS_GRANTS = [];

/**
 * Whether the given weaponEffect's own parent weapon carries the real 'multipleTargets'
 * E20.weaponTraits entry - a fact about the WEAPON, independent of how many targets happen to be
 * selected on any particular roll (dice.mjs#rollSkill still gates its own independent-roll
 * dispatch on 2+ actual targets separately - a single target has nothing to roll "independently"
 * against).
 * @param {Actor} actor
 * @param {Item} item   The weaponEffect being rolled, if any.
 * @returns {Boolean}
 */
export function isMultipleTargetsWeapon(actor, item) {
  if (item?.type != 'weaponEffect') {
    return false;
  }

  const parentId = item.flags?.essence20?.parentId;
  const weapon = parentId ? actor.items.get(parentId) : null;
  if (weapon?.system.itemAndUpgradeTraits?.includes('multipleTargets')) {
    return true;
  }

  // (Metallic Armor Power Up!'s Multiple Targets (2) while it's active is a MultipleTargets rule on the Power.)

  if (MULTIPLE_TARGETS_GRANTS.some(fn => {
    try {
      return !!fn(actor, item);
    } catch (error) {
      return false;
    }
  })) {
    return true;
  }

  // Volley (PR CRB, Pink Ranger, 1st level, p.48) - see items/attacks/volley.mjs's own doc comment.
  // Unlike Whirlwind Strike's own corrected build (an auto-targeted single roll), this genuinely
  // IS the real Multiple Targets trait's own independent-re-roll mechanic - RAW's own "Range,
  // cover, and other modifiers apply to these targets individually" is exactly what
  // isMultipleTargetsAttack's per-target dice pool already does. "Ranged" is read the same way
  // Precision Aim's own identical scoping already does elsewhere in this project - this system's
  // own weaponStyles enum has no literal 'ranged' value (only melee/energy/explosive/projectile),
  // so "ranged" is anything that isn't melee.
  return item.system.classification?.style != 'melee' && isVolleyActive(actor);
}
