import { describeCost, spend } from "../../mechanics/actions/action-economy.mjs";
import { ruleIgnoresTrait } from "../../rules/plugins/combat/trait-ignore.mjs";

/**
 * Mounted (GI Joe CRB, Weapon Effects and Traits, p.148; identical wording recurs in every core
 * rulebook's own Weapon Traits list): needs a mount (a tripod or rest) - a Standard action to set up,
 * a Free action to pick up.
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
  // TraitIgnore rules (rules/plugins/combat/trait-ignore.mjs - Ordnance Expert, Snipe From The Hip's Long Range Rifle).
  if (ruleIgnoresTrait(weapon?.parent, weapon, 'mounted')) {
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
