import { actorHasPerk } from "./perks.mjs";
import { isVolleyActive } from "./volley.mjs";
import { isMetallikatoMultipleTargetsActive } from "./metallikato.mjs";
import { isBoxShotActive } from "./box-shot.mjs";

/**
 * Multiple Targets (X, range/area) (p.198) - see dice.mjs#rollSkill's own doc comment (near its
 * own isMultipleTargetsAttack local) for the full Blast/AoE distinction. Extracted out of
 * dice.mjs itself once a second, non-roll-pipeline consumer showed up: No Need to Aim
 * (helpers/no-need-to-aim.mjs) checks this from item.mjs, before the roll even starts, not from
 * inside dice.mjs the way Trigger Happy/Gallantry/the independent-roll dispatch itself do.
 */

// Charge Into Battle (Through the Shattered Grid, Guardian of Eltar, 2nd level, p.72): "Whenever
// you wield a Melee Power Weapon, it gains Multiple Targets (2) if it does not have the Multiple
// Targets trait." A real trait grant, not just a proxy for one Perk's own bonus - widening this
// function's own truthiness here means every consumer (Trigger Happy, dice.mjs's own
// independent-roll dispatch, No Need to Aim) sees the same effective trait, matching how RAW
// phrases it as the weapon actually gaining the trait rather than a narrower "as if" clause.
const CHARGE_INTO_BATTLE_ID = "Compendium.essence20.through_the_shattered_grid.Item.34O7Y77lZpuhng3G";

// Metallikato (Decepticon Directive, General Perk, p.66) - see helpers/metallikato.mjs's own doc
// comment. Unlike Charge Into Battle's unconditional Power-Weapon grant above, this is a player-
// toggled benefit (spend a Free action, unenforced) scoped to melee attacks made "in Bot Mode."
const METALLIKATO_ID = "Compendium.essence20.decepticon_directive.Item.ouLZnb7j0kAfCrLx";

// Box Shot (Quartermaster's Guide to Gear, General Perk, p.28) - see BOX_SHOT_ID's own comment in
// banked-buffs.mjs.
const BOX_SHOT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.N8E3QTLUKX6DOoEc";

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

  if (item.system.classification?.style == 'melee'
    && !!weapon?.system.traits?.includes('powerWeapon')
    && actorHasPerk(actor, CHARGE_INTO_BATTLE_ID)) {
    return true;
  }

  if (item.system.classification?.style == 'melee' && actor?.system?.isTransformed === false
    && actorHasPerk(actor, METALLIKATO_ID) && isMetallikatoMultipleTargetsActive(actor)) {
    return true;
  }

  // Box Shot (Quartermaster's Guide to Gear, General Perk, p.28) - see helpers/box-shot.mjs's own
  // doc comment. Any weaponEffect (RAW names no style restriction), while the toggle is active.
  if (actorHasPerk(actor, BOX_SHOT_ID) && isBoxShotActive(actor)) {
    return true;
  }

  // Volley (PR CRB, Pink Ranger, 1st level, p.48) - see helpers/volley.mjs's own doc comment.
  // Unlike Whirlwind Strike's own corrected build (an auto-targeted single roll), this genuinely
  // IS the real Multiple Targets trait's own independent-re-roll mechanic - RAW's own "Range,
  // cover, and other modifiers apply to these targets individually" is exactly what
  // isMultipleTargetsAttack's per-target dice pool already does. "Ranged" is read the same way
  // Precision Aim's own identical scoping already does elsewhere in this project - this system's
  // own weaponStyles enum has no literal 'ranged' value (only melee/energy/explosive/projectile),
  // so "ranged" is anything that isn't melee.
  return item.system.classification?.style != 'melee' && isVolleyActive(actor);
}
