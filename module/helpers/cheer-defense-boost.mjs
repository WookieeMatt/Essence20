import { bankPendingBonus, getPendingBonus } from "./perks.mjs";
import { findRolePointsItem } from "./reroll.mjs";

/**
 * The shared shape behind two MLP CRB Laugh Tactics (p.86) - Rotten Tomatoes and Tough Crowd:
 *
 * > "Rotten Tomatoes: As a Move action, spend any amount of Cheer Points from your current pool
 * > to gain an equal increase to both your Toughness and Evasion Defenses for the rest of the
 * > scene."
 * > "Tough Crowd: ...spend any amount of Cheer Points from your current pool to gain an equal
 * > increase to both your Willpower and Cleverness Defenses for the rest of the scene."
 *
 * Both are "spend a player-chosen amount of a resource, gain that much to two named Defenses for
 * the rest of the scene" - the same player-chosen-amount picker as helpers/powered-plating.mjs's
 * own pickPoweredPlatingAmount (a numeric DialogV2), spending Cheer Points the way
 * helpers/clever-mind.mjs does (findRolePointsItem against the "Cheer Points" rolePoints Item),
 * and banked with perks.mjs#bankPendingBonus so it goes stale the same way every other "for the
 * rest of the scene" grant in this codebase does - when the current combat ends (encounter
 * approximates scene, the established idiom everywhere else here). Read back live and NOT
 * consumed (getCheerDefenseBoost), same "applies to every compared attack for as long as it
 * lasts" shape as Phantom Suite/Powered Plating's own Toughness bonus in dice.mjs, since the
 * whole point is it covers every Skill Test/attack against those Defenses for the rest of the
 * scene, not just the next one.
 */
const CHEER_POINTS_NAME = "Cheer Points";

/**
 * Prompts for how much Cheer (1 up to the current pool) to spend.
 * @param {Number} maxAmount
 * @returns {Promise<Number|null>}   The chosen amount, or null if cancelled/invalid.
 */
export async function pickCheerDefenseBoostAmount(maxAmount) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.CheerDefenseBoostPickAmountTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.CheerDefenseBoostPickAmountLabel')
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
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canAffordCheerDefenseBoost(actor) {
  return (findRolePointsItem(actor, CHEER_POINTS_NAME)?.system.resource.value ?? 0) >= 1;
}

/**
 * Prompts for an amount, spends that much Cheer, and banks the matching Defense bonus.
 * @param {Actor} actor
 * @param {String} flagKey   Which of the two Perks is banking this (their own flag).
 * @returns {Promise<Boolean>}   False if there was no Cheer to spend, or the picker was cancelled.
 */
export async function activateCheerDefenseBoost(actor, flagKey) {
  const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
  const maxAmount = rolePoints?.system.resource.value ?? 0;
  if (maxAmount <= 0) {
    return false;
  }

  const amount = await pickCheerDefenseBoostAmount(maxAmount);
  if (!amount) {
    return false;
  }

  await rolePoints.update({ 'system.resource.value': maxAmount - amount });
  await bankPendingBonus(actor, flagKey, { amount });
  return true;
}

/**
 * The actor's own currently-banked bonus, still live this combat/scene - 0 once it's gone stale.
 * @param {Actor} actor
 * @param {String} flagKey
 * @returns {Number}
 */
export function getCheerDefenseBoost(actor, flagKey) {
  return getPendingBonus(actor, flagKey)?.amount ?? 0;
}
