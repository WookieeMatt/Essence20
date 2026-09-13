/**
 * Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32): "While
 * Morphed, you may spend up to 4 Personal Power to add +1 armor bonus per Power spent to your
 * Toughness Defense until you are no longer Morphed."
 *
 * Unlike every other "spend a resource, gain a bonus" Perk in this project, the SPEND amount is
 * itself a player choice (1-4, capped by what they can actually afford) rather than a fixed or
 * scaling number - a new pickPoweredPlatingAmount() dialog (a numeric input, the same DialogV2
 * shape as helpers/banked-buffs.mjs#pickHobbleCondition's own select, just a number field
 * instead). The granted bonus can't touch _prepareDefenses (the user's own pending Defense-math
 * migration) - like Phantom Suite's own Evasion Defense bonus, it's a live, non-consumed read in
 * dice.mjs's per-target checkEntries construction instead, applying to every Toughness-compared
 * attack for as long as it lasts, not just the next one. "Until you are no longer Morphed" is
 * actively cleared (not left to the player to notice) via sheet-handlers/power-ranger-handler.mjs
 * #onMorph, right where Boosted Vigor's own Morph-time toggle already lives.
 */

const POWERED_PLATING_FLAG = 'poweredPlatingBonus';
const MAX_AMOUNT = 4;

/**
 * Prompts for how much Power (1 up to what's actually available, capped at 4) to spend.
 * @param {Number} maxAmount
 * @returns {Promise<Number|null>}   The chosen amount, or null if cancelled/invalid.
 */
export async function pickPoweredPlatingAmount(maxAmount) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PoweredPlatingPickAmountTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PoweredPlatingPickAmountLabel')
    }</label><input type="number" name="amount" min="1" max="${maxAmount}" value="1" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => parseInt(button.form.elements.amount.value),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return Number.isInteger(chosen) && chosen > 0 ? Math.min(chosen, maxAmount) : null;
}

/**
 * Prompts for an amount, spends that much Power, and banks the matching Toughness Defense bonus.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing spent) if there was no Power to spend, or the
 *   picker was cancelled.
 */
export async function activatePoweredPlating(actor) {
  const maxAmount = Math.min(MAX_AMOUNT, actor.system.powers.personal.value);
  if (maxAmount <= 0) {
    return false;
  }

  const amount = await pickPoweredPlatingAmount(maxAmount);
  if (!amount) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - amount });
  await actor.setFlag('essence20', POWERED_PLATING_FLAG, amount);
  return true;
}

/**
 * The actor's own currently-banked Toughness Defense bonus, if still Morphed - 0 otherwise (also
 * the safety-net path if onMorph's own clear somehow didn't fire).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getPoweredPlatingBonus(actor) {
  return actor?.system?.isMorphed ? (actor.getFlag?.('essence20', POWERED_PLATING_FLAG) ?? 0) : 0;
}

/**
 * Clears the banked bonus - called from onMorph() right as the actor un-Morphs, no refund.
 * @param {Actor} actor
 */
export async function clearPoweredPlating(actor) {
  await actor.unsetFlag('essence20', POWERED_PLATING_FLAG);
}
