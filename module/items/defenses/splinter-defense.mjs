import { roleValueChange } from "../../sheet-handlers/role-handler.mjs";

/**
 * Splinter Defense (Across the Stars, Gold Ranger, 18th level, p.53): "Any creature that hits you
 * with a melee Attack automatically suffers an Initiative penalty equal to your Hardened Armor
 * bonus... once per target per combat" - "target" here is the ATTACKER being penalized (the same
 * creature can't be docked twice by the same Gold Ranger in one combat), not the Gold Ranger
 * themselves.
 *
 * The penalty itself is a targeted Trigger rule on the Perk (round 15) - this file keeps the Hardened Armor bonus it
 * reads (@hardenedArmor, rules/plugins/tags/dice-refs.mjs).
 */

/**
 * The actor's current Hardened Armor bonus (Gold Ranger's own scaling Toughness rolePoints item,
 * already read generically by Essence20Actor#_prepareDefenses for the Defense total itself) - the
 * exact same startingValue/increaseLevels/level20Value computation _prepareDefenses uses, just
 * exposed as a standalone number rather than folded into a Defense total.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getHardenedArmorBonus(actor) {
  const rolePoints = actor._getBaseRolePoints?.();
  if (!rolePoints || rolePoints.system.bonus.type != 'defenseBonus' || !rolePoints.system.bonus.defenseBonus?.toughness) {
    return 0;
  }

  if (actor.system.level == 20) {
    return rolePoints.system.bonus.level20Value ?? 0;
  }

  return rolePoints.system.bonus.startingValue + roleValueChange(actor.system.level, rolePoints.system.bonus.increaseLevels);
}
