/**
 * Like Water (Factions in Action Vol. 2: Intercontinental Adventures, General Perk, p.30): "You
 * gain the following benefits, each of which may be used only once per Combat: You may spend a
 * Standard action to gain a temporary +2 bonus to Toughness. This bonus lasts until the end of
 * Combat. You may spend a Standard action to gain a temporary +2 bonus to Evasion. This bonus
 * lasts until the end of Combat. If you succeed on an Attack against an opponent with a Martial
 * Arts weapon, you may choose to make it a Critical Success. If an enemy fails an Attack against
 * you, your next Attack targeting them gains an Edge."
 *
 * Only the two Defense-boost clauses are built here. The compendium item shipped with 2 disabled
 * placeholder Active Effects (+2 Toughness/+2 Evasion) - those are the WRONG shape for this RAW
 * text (a permanent, unconditional bonus would misrepresent "spend a Standard action, once per
 * Combat" as a free always-on grant) and are left disabled/unused rather than enabled outright;
 * this file replaces them with a proper activated-once-per-combat toggle instead, the same live,
 * non-consumed Defense-bonus shape Bolster Defense/Jury Rig's own Align Suspension already
 * establish, gated one-shot via a plain flag (no need to ever toggle back off - the bonus already
 * only ever gets granted once).
 *
 * The Critical-Success-on-a-Martial-Arts-Attack clause and the reciprocal "gain an Edge after an
 * enemy misses you" clause are NOT built - the former needs a reactive post-hit chat-button choice
 * (buildable, but a genuinely separate feature from the other two, and not attempted this pass),
 * and the latter needs the still-missing "react to being attacked" hook this project has flagged
 * many times before (Fe-BURN!, Defender Step, Projectile Deflector, etc.).
 *
 * This system only ever gives one Perk item one "Use" button (see EMT Crash Course's own doc
 * comment), so the two built clauses share a single dynamic picker - whichever of the two hasn't
 * been used yet this Combat, the same "options list built from current state" idiom Eltarian
 * Mettle's own dynamic Condition picker already established, rather than two separate buttons.
 */

const TOUGHNESS_FLAG = 'likeWaterToughnessActive';
const EVASION_FLAG = 'likeWaterEvasionActive';

/**
 * @param {Actor} actor
 * @returns {String[]}   Zero, one, or both of 'toughness'/'evasion' - whichever hasn't been
 *   activated yet this Combat.
 */
export function getAvailableLikeWaterOptions(actor) {
  const options = [];
  if (!actor.getFlag?.('essence20', TOUGHNESS_FLAG)) {
    options.push('toughness');
  }

  if (!actor.getFlag?.('essence20', EVASION_FLAG)) {
    options.push('evasion');
  }

  return options;
}

/**
 * Prompts for which still-available Like Water bonus to activate.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   'toughness' or 'evasion', or null if both are already used
 *   this Combat or the picker was cancelled.
 */
export async function pickLikeWaterOption(actor) {
  const available = getAvailableLikeWaterOptions(actor);
  if (!available.length) {
    return null;
  }

  const options = available
    .map(key => `<option value="${key}">${game.i18n.localize(key == 'toughness' ? 'E20.LikeWaterToughness' : 'E20.LikeWaterEvasion')}</option>`)
    .join('');
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
 * @param {Actor} actor
 * @param {String} option   'toughness' or 'evasion'.
 */
export async function activateLikeWaterOption(actor, option) {
  await actor.setFlag('essence20', option == 'toughness' ? TOUGHNESS_FLAG : EVASION_FLAG, true);
}

/**
 * Prompts for and activates one still-available Like Water bonus.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The option activated, or null if there was nothing left to
 *   activate or the picker was cancelled.
 */
export async function applyLikeWater(actor) {
  const option = await pickLikeWaterOption(actor);
  if (!option) {
    return null;
  }

  await activateLikeWaterOption(actor, option);
  return option;
}

/**
 * The live, non-consumed Defense bonus either activated Like Water clause grants, for the given
 * Defense comparison - same shape as helpers/bolster-defense.mjs#getBolsterDefenseBonus.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getLikeWaterDefenseBonus(actor, defenseType) {
  if (defenseType == 'toughness' && actor.getFlag?.('essence20', TOUGHNESS_FLAG)) {
    return 2;
  }

  if (defenseType == 'evasion' && actor.getFlag?.('essence20', EVASION_FLAG)) {
    return 2;
  }

  return 0;
}
