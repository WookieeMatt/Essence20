/**
 * Multiple Targets (X, range/area) (p.198) - see dice.mjs#rollSkill's own doc comment (near its
 * own isMultipleTargetsAttack local) for the full Blast/AoE distinction. Extracted out of
 * dice.mjs itself once a second, non-roll-pipeline consumer showed up: No Need to Aim
 * (helpers/no-need-to-aim.mjs) checks this from item.mjs, before the roll even starts, not from
 * inside dice.mjs the way Trigger Happy/Gallantry/the independent-roll dispatch itself do.
 */

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
  return !!weapon?.system.itemAndUpgradeTraits?.includes('multipleTargets');
}
