import { actorHas, TRAIT_PERK } from "../../mechanics/combat/weapon-traits.mjs";
import { describeCost, spend } from "../../mechanics/actions/action-economy.mjs";

// Ordnance Expert (GI Joe CRB Focus Perk): "You ignore the mounted trait on weapons."
export const ORDNANCE_EXPERT = "Compendium.essence20.gi_joe_crb.Item.bB7Fiuu6BjIUlAgt";

/**
 * Mounted (GI Joe CRB, Weapon Effects and Traits, p.148; identical wording recurs in every core
 * rulebook's own Weapon Traits list): "Requires a mount, such as a tripod or shooting rest, that
 * takes a Standard action to set up, and a Free action to pick up."
 *
 * Modelled as a per-weapon Item flag ('mountedSetUp'), the same idiom mechanics/combat/reload-trait.mjs's own
 * needsReload already establishes - a Mounted weapon starts NOT set up (flag absent), can't be
 * fired until a Standard action sets it up, and folds back down (a Free action) whenever its
 * wielder wants to move with it. Unlike Reload, this is a persistent state rather than something
 * cleared automatically by firing - once set up, it stays set up (and firable) across turns until
 * something explicitly picks it back up.
 */

/**
 * Whether this Mounted weapon is currently deployed and ready to fire.
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isMountedWeaponSetUp(weapon) {
  // Snipe From The Hip (TF CRB, Sharpshooter, 17th level, p.70): "you ignore your Long Range Rifle's
  // Mounted trait."
  if (/long range rifle/i.test(weapon?.name ?? '') && actorHas(weapon?.parent, TRAIT_PERK.snipeFromTheHip)) {
    return true;
  }

  if (actorHas(weapon?.parent, ORDNANCE_EXPERT)) {
    return true;
  }

  return !!weapon?.getFlag?.('essence20', 'mountedSetUp');
}

/**
 * Spends a Standard action to set the weapon up. Returns whether it actually got set up - false
 * (with a UI warning already shown, matching item.mjs#roll's own action-economy idiom) if the
 * actor couldn't afford it.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<Boolean>}
 */
export async function setUpMountedWeapon(actor, weapon) {
  const result = await spend(actor, 'standard', { source: weapon?.name });
  if (result.blocked) {
    if (!result.cancelled) {
      ui.notifications.warn(game.i18n.format('E20.ActionEconomyUnaffordable', {
        name: actor?.name ?? '',
        action: describeCost(result.cost),
      }));
    }

    return false;
  }

  await weapon.setFlag('essence20', 'mountedSetUp', true);
  return true;
}

/**
 * Spends a Free action to pick the weapon back up. Same unaffordable-report shape as
 * setUpMountedWeapon above, though a Free action being unaffordable should be rare in practice.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<Boolean>}
 */
export async function pickUpMountedWeapon(actor, weapon) {
  const result = await spend(actor, 'free', { source: weapon?.name });
  if (result.blocked) {
    if (!result.cancelled) {
      ui.notifications.warn(game.i18n.format('E20.ActionEconomyUnaffordable', {
        name: actor?.name ?? '',
        action: describeCost(result.cost),
      }));
    }

    return false;
  }

  await weapon.unsetFlag('essence20', 'mountedSetUp');
  return true;
}
