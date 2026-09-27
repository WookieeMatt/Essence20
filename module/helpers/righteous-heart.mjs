import { bankPendingBonus, getPendingBonus } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Righteous Heart (PR CRB, General Perk, p.98): "While Morphed, you may spend a Free action to
 * gain Resistance to any one type of damage. This Resistance lasts until the end of your next
 * turn." The fear-immunity half is already built (helpers/condition-immunity.mjs's own
 * RIGHTEOUS_HEART_ID entry); this file is only the still-unbuilt Resistance half.
 *
 * "Until the end of your next turn" is approximated the same documented way bankPendingBonus's
 * own doc comment already accepts for every other "until X" clause this codebase leaves
 * unenforced by real turn tracking: the choice is banked now and consumed the next time it
 * actually matters (the next attack of the chosen damage type against this actor), rather than
 * expiring on a real turn-boundary timer. The choice itself reuses Emotional Mastery: Contempt's
 * own "pick one damage type" DialogV2 shape (helpers/emotional-mastery.mjs#pickContemptDamageType)
 * - the two Perks ask for literally the same choice.
 */
export const RIGHTEOUS_HEART_ID = "Compendium.essence20.pr_crb.Item.mOgEBZIbiaT07eAq";

export const RIGHTEOUS_HEART_RESISTANCE_FLAG = 'pendingRighteousHeartResistance';

/**
 * Righteous Heart is a Free action with no scene/day limit and no cost - RAW gives it nothing to
 * gate on beyond being Morphed, so the "Use" button is always available while Morphed.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseRighteousHeart(actor) {
  return !!actor.system.isMorphed;
}

/**
 * The same "choose one damage type" DialogV2 Contempt already established, reused verbatim in
 * shape (a distinct instance rather than importing Contempt's own private, module-scoped copy -
 * that one is deliberately not exported, since it's specific to the Emotional Mastery sub-picker
 * flow, not a shared UI atom).
 * @returns {Promise<String|null>}
 */
async function pickRighteousHeartDamageType() {
  const options = Object.keys(E20.damageTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RighteousHeart') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RighteousHeartPickLabel')
    }</label><select name="damageType">${options}</select></div>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.damageType.value },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for the damage type and banks it as a pending Resistance - see getRighteousHeartResistance
 * below for how it's read back and consumed.
 * @param {Actor} actor
 */
export async function activateRighteousHeart(actor) {
  const damageType = await pickRighteousHeartDamageType();
  if (!damageType) {
    return;
  }

  await bankPendingBonus(actor, RIGHTEOUS_HEART_RESISTANCE_FLAG, { damageType });
}

/**
 * Whether the given actor currently has a banked Righteous Heart Resistance to this damage type -
 * read live, parallel to the static system.resistances field, the same shape Contempt/Lance of
 * Light/Defensive Flexibility's own toggleable Resistances already use in dice.mjs's own
 * Resistance-Snag check. Does NOT clear the pending bonus itself - see
 * consumeRighteousHeartResistance below, called only once the attack actually resolves.
 * @param {Actor} actor
 * @param {String} damageType
 * @returns {Boolean}
 */
export function hasRighteousHeartResistance(actor, damageType) {
  return !!damageType && getPendingBonus(actor, RIGHTEOUS_HEART_RESISTANCE_FLAG)?.damageType == damageType;
}
