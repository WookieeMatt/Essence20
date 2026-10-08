import { spend } from "../../mechanics/actions/action-economy.mjs";

/**
 * Mythically Modular (Through the Shattered Grid, New Weapon Trait and Upgrade, p.116): two or
 * more weapons or shields merged into one that switches form as a Free action. The upgrade of the same name gives the trait to
 * each of the weapons being combined, so every form is its own weapon Item on the sheet.
 *
 * A form is "in use" when its weapon is equipped (the same "wielding" idiom dice.mjs already
 * reads off system.equipped). The actor sheet's per-weapon Switch Form control
 * (templates/actor/parts/items/weapon/container.hbs) equips that form and unequips the actor's
 * other Mythically Modular weapons, spending a Free action through the action economy; an attack
 * with an unequipped form is refused until it's switched to (documents/item.mjs#roll). A weapon
 * with the trait but no other Mythically Modular weapon on the actor - both forms authored as one
 * Item's weaponEffects - has nothing to switch between and is never blocked.
 *
 * Grouping is "every Mythically Modular weapon this actor owns": there is no per-pair link in the
 * data, and a character carrying two separate combined weapons is rare enough that switching one
 * unequipping the other is an acceptable simplification (the player just re-equips it).
 */

/**
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isMythicallyModular(weapon) {
  if (weapon?.type != 'weapon') {
    return false;
  }

  const traits = weapon.system?.itemAndUpgradeTraits
    ?? [...(weapon.system?.traits ?? []), ...(weapon.system?.upgradeTraits ?? [])];
  return traits.includes('mythicallyModular');
}

/**
 * The other forms this weapon can switch with.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Array<Item>}
 */
export function getMythicForms(actor, weapon) {
  const items = actor?.items;
  if (!items || typeof items.filter != 'function' || !isMythicallyModular(weapon)) {
    return [];
  }

  return items.filter(item => item.id != weapon.id && isMythicallyModular(item));
}

/**
 * Whether an attack with this weapon should be refused because another form is in use.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function isInactiveMythicForm(actor, weapon) {
  return !!weapon && !weapon.system?.equipped && getMythicForms(actor, weapon).length > 0;
}

/**
 * Switches to this form: a Free action, then equips it and unequips every other form.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<Boolean>}   Whether the switch happened.
 */
export async function switchMythicForm(actor, weapon) {
  const others = getMythicForms(actor, weapon);
  if (!others.length) {
    ui.notifications.warn(game.i18n.format('E20.MythicallyModularNoForms', { name: weapon?.name ?? '' }));
    return false;
  }

  if (weapon.system.equipped && others.every(other => !other.system.equipped)) {
    return false;
  }

  const result = await spend(actor, 'free', { source: weapon.name });
  if (result.blocked) {
    return false;
  }

  await actor.updateEmbeddedDocuments('Item', [
    { _id: weapon.id, 'system.equipped': true },
    ...others.filter(other => other.system.equipped).map(other => ({ _id: other.id, 'system.equipped': false })),
  ]);
  return true;
}
