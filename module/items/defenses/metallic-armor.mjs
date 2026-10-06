/**
 * Metallic Armor Power Up! (Through the Shattered Grid, Grid Power, p.26): "Activate your
 * Metallic Armor as a Free action when Morphed by spending 2 Personal Power... this Power-hungry
 * upgrade costs 1 Personal Power at the start of each subsequent turn to maintain. When you
 * activate Metallic Armor, you gain the following: the Metallic Armor forms an additional layer of
 * protection... granting you three temporary Health. Your Attacks gain the Multiple Targets (2)
 * trait, and Attacks that already have the Multiple Targets trait increase the number of targets by
 * 1... You reduce the damage dealt to you by minion and foot soldier enemies by 1... While Metallic
 * Armor is active, you cannot teleport. Metallic armor... lasts until you choose to end it, you
 * cannot pay the Personal Power to continue using it, you suffer a Critical Success on an Attack by
 * a non-minion Threat, or you are Defeated."
 *
 * This file builds the +3 temporary Health grant and the per-turn 1-Power maintenance drain
 * (auto-deactivating if unaffordable). The rest lives in items/forms/mega-defender.mjs: the
 * minion/foot-soldier damage reduction (minions read from creature tags, see creature-tags.mjs), the
 * auto-end on a Critical Success from a non-minion Threat or on Defeat, and an "End Metallic Armor"
 * Use button for choosing to end it.
 *
 * Still not built:
 * - The "+1 target" for attacks that already have Multiple Targets: no target count is enforced
 *   anywhere, so there is nothing to raise. The trait itself is granted (multiple-targets.mjs).
 * "Cannot teleport" is enforced on the token: the Blink movement action isn't offered while it's
 * active (mechanics/combat/token-movement.mjs#configureMovementActions).
 */
const METALLIC_ARMOR_FLAG = 'metallicArmorActive';
const METALLIC_ARMOR_TEMP_HEALTH = 3;
const METALLIC_ARMOR_MAINTENANCE_COST = 1;

export function isMetallicArmorActive(actor) {
  return !!actor.getFlag?.('essence20', METALLIC_ARMOR_FLAG);
}

/**
 * Activates Metallic Armor, if it isn't already active - grants +3 temporary Health. A no-op
 * (returns false) if already active, matching Speed Boost's own "second click does nothing
 * further" shape.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateMetallicArmor(actor) {
  if (isMetallicArmorActive(actor)) {
    return false;
  }

  await actor.setFlag('essence20', METALLIC_ARMOR_FLAG, true);
  await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + METALLIC_ARMOR_TEMP_HEALTH });
  return true;
}

async function deactivateMetallicArmor(actor) {
  await actor.setFlag('essence20', METALLIC_ARMOR_FLAG, false);
  await actor.update({
    'system.health.bonus': Math.max(0, (actor.system.health.bonus ?? 0) - METALLIC_ARMOR_TEMP_HEALTH),
  });
}

/**
 * Called from essence20.mjs's own combatTurn/combatRound hooks for whoever's turn is starting -
 * pays the 1-Power maintenance cost if active and affordable, or deactivates (removing the
 * temporary Health) if not.
 * @param {Actor} actor
 */
export async function payMetallicArmorMaintenance(actor) {
  if (!isMetallicArmorActive(actor)) {
    return;
  }

  if (actor.system.powers.personal.value >= METALLIC_ARMOR_MAINTENANCE_COST) {
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - METALLIC_ARMOR_MAINTENANCE_COST });
  } else {
    await deactivateMetallicArmor(actor);
  }
}
