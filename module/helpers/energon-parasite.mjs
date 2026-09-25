export const ENERGON_PARASITE_ID = "Compendium.essence20.technorganic_secrets.Item.6myBQHifgs2IHGsC";

/**
 * Energon Parasite (Technorganic Secrets, General Perk, p.46, prerequisite Level 2): "You can
 * absorb Energon from Defeated Cybertronians. Discuss with your GM what this looks like. The
 * target must be in a Defeated state, have undergone the Great Upgrade, and must have the ability
 * to convert into an at least partially organic Alt Mode. You can drain as many Energon Points
 * from the target as they have stored or up to your lowest Essence Score, whichever is lower.
 * Your maximum Energon capacity applies."
 *
 * CORRECTED against the Ledger's own prior framing: this was filed under "Lifesteal / damage-
 * over-time-on-hit mechanism," but it isn't a lifesteal effect at all - it's a post-combat resource
 * TRANSFER from an already-Defeated target, not something that triggers off dealing damage. Only
 * the concrete numeric transfer rule is automated here; the "underwent the Great Upgrade" and
 * "at least partially organic Alt Mode" preconditions are build-time facts about the TARGET's own
 * character with no single field to check (and RAW itself says "discuss with your GM what this
 * looks like"), so - matching this project's own accepted "narrative precondition, mechanical
 * effect automated" idiom (e.g. Bits To Spare/Truthseeker) - this only gates on the one condition
 * that IS a real, checkable flag: the target's own Defeated status.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Number}   The amount of Energon that would actually transfer (0 if none).
 */
export function getEnergonParasiteDrainAmount(actor, target) {
  const essences = actor.system.essences;
  const lowestEssence = Math.min(
    essences.strength.value, essences.speed.value, essences.smarts.value, essences.social.value,
  );
  const remainingCapacity = Math.max(0, actor.system.energon.normal.max - actor.system.energon.normal.value);

  return Math.max(0, Math.min(target.system.energon.normal.value, lowestEssence, remainingCapacity));
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseEnergonParasite(actor) {
  const target = game.user.targets.first()?.actor;
  return !!target && !!target.statuses?.has('defeated') && getEnergonParasiteDrainAmount(actor, target) > 0;
}

/**
 * @param {Actor} actor
 * @returns {Number}   The amount actually drained (0 if nothing happened).
 */
export async function activateEnergonParasite(actor) {
  const target = game.user.targets.first()?.actor;
  if (!target || !target.statuses?.has('defeated')) {
    ui.notifications.warn(game.i18n.localize('E20.EnergonParasiteNoTarget'));
    return 0;
  }

  const drainAmount = getEnergonParasiteDrainAmount(actor, target);
  if (drainAmount <= 0) {
    return 0;
  }

  await target.update({ 'system.energon.normal.value': target.system.energon.normal.value - drainAmount });
  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value + drainAmount });

  return drainAmount;
}
