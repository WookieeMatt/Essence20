import { roleValueChange } from "../sheet-handlers/role-handler.mjs";

/**
 * Splinter Defense (Across the Stars, Gold Ranger, 18th level, p.53): "Any creature that hits you
 * with a melee Attack automatically suffers an Initiative penalty equal to your Hardened Armor
 * bonus... once per target per combat" - "target" here is the ATTACKER being penalized (the same
 * creature can't be docked twice by the same Gold Ranger in one combat), not the Gold Ranger
 * themselves.
 *
 * Read/applied from dice.mjs's own post-hit processing (see checkContext.isMelee and the
 * SPLINTER_DEFENSE_ID check there) once a successful melee hit against the holder is confirmed.
 */
const SPLINTER_DEFENSE_FLAG = 'splinterDefenseAttackers';

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

/**
 * Whether Splinter Defense should still trigger against this attacker this combat - true (and
 * marks it used) the first time a given attacker hits this actor in the current combat, false
 * (and does nothing) on any later hit from the same attacker before the combat ends.
 * @param {Actor} targetActor   The Splinter Defense holder who was just hit.
 * @param {String} attackerId   The attacking actor's own id.
 * @returns {Promise<Boolean>}
 */
export async function checkAndMarkSplinterDefense(targetActor, attackerId) {
  if (!game.combat) {
    return false;
  }

  const stored = targetActor.getFlag?.('essence20', SPLINTER_DEFENSE_FLAG);
  const attackerIds = stored?.combatId == game.combat.id ? stored.attackerIds : [];
  if (attackerIds.includes(attackerId)) {
    return false;
  }

  await targetActor.setFlag('essence20', SPLINTER_DEFENSE_FLAG, {
    combatId: game.combat.id,
    attackerIds: [...attackerIds, attackerId],
  });
  return true;
}
