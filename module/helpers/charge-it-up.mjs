import { bankPendingBonus, getPendingBonus, clearPendingBonus } from "./perks.mjs";

/**
 * Charge It Up! (A Jump Through Time, Ranger Operator [Form] Grid Power, p.59): "You can spend a
 * Standard action and 1 Personal Power while Morphed to cause your next melee Attack with a Power
 * Weapon to ignore all benefits gained from a target's armor and any Resistances, immunities, or
 * other damage mitigation effects."
 *
 * The Power cost itself is already spent generically by sheet-handlers/power-handler.mjs before
 * this ever runs (see helpers/power-use.mjs#onPowerUse's own doc comment) - this only banks the
 * "next melee Power Weapon Attack" flag, consumed in dice.mjs#rollSkill's own per-target difficulty
 * construction the same way Quantum Cut's own applyQuantumCut flag is. Only the armor half is
 * actually enforceable: this codebase has no live Resistance-halving or Immunity-bypass mechanism
 * for applyDamage to hook into (Immunity itself is a hard zero, not something a single Attack can
 * be made to punch through) - same "build the enforceable half, note the rest" idiom Enhance
 * (Attack)'s own ignoreArmor option already accepts in zord-feature-handler.mjs.
 */
export const CHARGE_IT_UP_ID = "Compendium.essence20.jump_through_time.Item.eDLYdEHBTU2S2qp0";
export const PENDING_CHARGE_IT_UP_FLAG = 'pendingChargeItUp';

/**
 * Banks the "next melee Power Weapon Attack ignores armor" flag - warns instead if the actor isn't
 * currently Morphed, matching RAW's own "while Morphed" restriction.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the flag was actually banked.
 */
export async function activateChargeItUp(actor) {
  if (!actor.system.isMorphed) {
    ui.notifications.warn(game.i18n.localize('E20.ChargeItUpNotMorphed'));
    return false;
  }

  await bankPendingBonus(actor, PENDING_CHARGE_IT_UP_FLAG, {});
  return true;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasPendingChargeItUp(actor) {
  return !!getPendingBonus(actor, PENDING_CHARGE_IT_UP_FLAG);
}

/**
 * Consumes the banked flag once the qualifying Attack actually rolls.
 * @param {Actor} actor
 */
export async function consumeChargeItUp(actor) {
  await clearPendingBonus(actor, PENDING_CHARGE_IT_UP_FLAG);
}
