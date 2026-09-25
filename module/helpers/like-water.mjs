/**
 * Like Water (Factions in Action Vol. 2: Intercontinental Adventures, Arashikage General Perk,
 * p.32): "You gain the following benefits, each of which may be used only once per Combat: You
 * may spend a Standard action to gain a temporary +2 bonus to Toughness. This bonus lasts until
 * the end of Combat. You may spend a Standard action to gain a temporary +2 bonus to Evasion.
 * This bonus lasts until the end of Combat."
 *
 * Only these first two clauses are built here. "If you succeed on an Attack against an opponent
 * with a Martial Arts weapon, you may choose to make it a Critical Success" and "if an enemy
 * fails an Attack against you, your next Attack targeting them gains an Edge" are separate crit-
 * upgrade/banked-Edge mechanics not attempted this pass.
 *
 * A Standard action, no roll and no other cost - the "Use" button banks which Defense was chosen
 * directly, no dice involved, same shape as Bolster Defense's own banked bonus except with
 * nothing to roll first. Can't touch `_prepareDefenses` (the user's own pending Health/Defense-
 * math migration), so this is a live, non-consumed read in dice.mjs's own difficulty calculation,
 * same shape as Bolster Defense/Jury Rig's own Defense bonuses. "Until end of Combat" has no
 * active clearing hook (this codebase has no combat-end event) - left in place until manually
 * cleared, the same "approximate an unenforceable duration, GM manages the edges" idiom Bolster
 * Defense's own "until end of scene" clause already uses. The two benefits are independent (each
 * its own once-per-Combat use, both obtainable in the same fight for 2 separate Standard actions)
 * - the picker only offers whichever hasn't been used yet, and the "Use" button stays available
 * as long as either one remains.
 */
export const LIKE_WATER_ID = "Compendium.essence20.intercontinental_adventures.Item.HSjShnVmoDdzEDT1";

const LIKE_WATER_OPTION_LABELS = {
  toughness: 'E20.LikeWaterToughness',
  evasion: 'E20.LikeWaterEvasion',
};
export const LIKE_WATER_OPTIONS = Object.keys(LIKE_WATER_OPTION_LABELS);

// One boolean flag per option, doing double duty as both "already used this Combat" (the
// once-per-Combat cap) and "currently granting its +2" (read live by getLikeWaterDefenseBonus) -
// setting it true both spends the once-per-Combat use AND turns the bonus on, since RAW's own
// "lasts until the end of Combat" means those two facts never diverge for this Perk.
function likeWaterActiveFlag(option) {
  return `likeWater${option.charAt(0).toUpperCase()}${option.slice(1)}Active`;
}

/**
 * Which of Like Water's two benefits are still available this Combat.
 * @param {Actor} actor
 * @returns {Array<String>}   A subset of LIKE_WATER_OPTIONS.
 */
export function getAvailableLikeWaterOptions(actor) {
  return LIKE_WATER_OPTIONS.filter(option => !actor?.getFlag?.('essence20', likeWaterActiveFlag(option)));
}

/**
 * @param {Array<String>} available   The still-available options, from getAvailableLikeWaterOptions.
 * @returns {Promise<String|null>}   The chosen option, or null if cancelled.
 */
export async function pickLikeWaterOption(available) {
  const options = available
    .map(key => `<option value="${key}">${game.i18n.localize(LIKE_WATER_OPTION_LABELS[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.LikeWaterPickOptionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.LikeWaterPickOptionLabel')
    }</label><select name="option">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.option.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for whichever benefit(s) are still available and banks the choice directly (no roll to
 * gate it on).
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The option activated, or null if there was nothing available
 *   or the picker was cancelled.
 */
export async function applyLikeWater(actor) {
  const available = getAvailableLikeWaterOptions(actor);
  if (!available.length) {
    return null;
  }

  const option = available.length > 1 ? await pickLikeWaterOption(available) : available[0];
  if (!option) {
    return null;
  }

  await actor.setFlag('essence20', likeWaterActiveFlag(option), true);
  return option;
}

/**
 * The live Defense bonus Like Water is currently granting - read directly in dice.mjs's own
 * difficulty calculation (can't touch `_prepareDefenses`).
 * @param {Actor} actor
 * @param {String} defenseType   e.g. 'toughness', 'evasion'.
 * @returns {Number}
 */
export function getLikeWaterDefenseBonus(actor, defenseType) {
  if (!LIKE_WATER_OPTIONS.includes(defenseType)) {
    return 0;
  }

  return actor?.getFlag?.('essence20', likeWaterActiveFlag(defenseType)) ? 2 : 0;
}
