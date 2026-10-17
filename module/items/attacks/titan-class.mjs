/**
 * Titan-Class (The Enigma of Combination p.49; Technorganic Secrets p.21): the wielder must spend 1 Energon Point before
 * attacking with the weapon - once a round, however many attacks Perks give it that round. (Ignoring armor-upgrade
 * Toughness against smaller targets is dice.mjs's.) A wielder with no Energon to spend can't attack with it.
 */
import { registerPreRoll } from "../../mechanics/item-hooks.mjs";

const PAID_FLAG = 'titanClassPaid';

/** The weapon an attack belongs to. */
const parentWeapon = (actor, item) => (item?.type == 'weaponEffect' ? actor?.items?.get?.(item.flags?.essence20?.parentId) ?? null : null);

/** Whether this attack is a Titan-class weapon's. */
export const isTitanClassAttack = (actor, item) => !!parentWeapon(actor, item)?.system?.traits?.includes?.('titanClass');

/** Already paid this round (in combat). */
export function paidThisRound(actor, combat = game.combat) {
  const paid = actor?.flags?.essence20?.[PAID_FLAG];
  return !!(combat?.started && paid && paid.combatId == combat.id && paid.round == combat.round);
}

/**
 * Pay the Energon Point, or refuse the roll.
 * @returns {Promise<Boolean>}   Whether the attack may go ahead
 */
export async function payTitanClass(actor) {
  if (paidThisRound(actor)) {
    return true;
  }

  const energon = Number(actor.system?.energon?.normal?.value) || 0;
  if (energon < 1) {
    ui.notifications.warn(game.i18n.format('E20.TitanClassNoEnergon', { name: actor.name }));
    return false;
  }

  const update = { 'system.energon.normal.value': energon - 1 };
  if (game.combat?.started) {
    update[`flags.essence20.${PAID_FLAG}`] = { combatId: game.combat.id, round: game.combat.round };
  }

  await actor.update(update);
  ui.notifications.info(game.i18n.format('E20.TitanClassPaid', { name: actor.name }));
  return true;
}

registerPreRoll(async (actor, dataset, item) => {
  // A weapon four or more Size Classes larger than its wielder can't be wielded normally (EoC p.48) - weapon-upscale.mjs.
  if (!dataset.cancelRoll && parentWeapon(actor, item)?.system?.tooLargeToWield) {
    ui.notifications.warn(game.i18n.format('E20.WeaponTooLarge', { weapon: parentWeapon(actor, item).name, name: actor.name }));
    dataset.cancelRoll = true;
  }

  if (!dataset.cancelRoll && isTitanClassAttack(actor, item) && !(await payTitanClass(actor))) {
    dataset.cancelRoll = true;
  }
});
