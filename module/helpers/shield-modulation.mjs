import { actorHasPerk } from "./perks.mjs";
import { isPersonalShieldItem } from "./personal-shield.mjs";
import { E20 } from "./config.mjs";

/**
 * Shield Modulation (Vanguard base, 13th level, p.109): "When you activate your shield, choose
 * one damage type. You and any allies protected by your shield are resistant to that damage
 * type." Unlike every other Perk this session, the choice has to be made at the exact moment the
 * shield's own Active toggle is switched on (sheets/base-actor-sheet.mjs's own
 * _activateRolePointsListeners click handler) - not a roll-time checkbox, and not a standalone
 * sheet "Use" button like the banked-buffs.mjs Perks, since there's no separate action to hang it
 * off; activating the shield IS the trigger. This file holds the two testable pieces (whether to
 * prompt, and the prompt/storage themselves); the sheet click handler just calls them before
 * proceeding with the plain isActive toggle it already does for everyone else.
 *
 * Consumption lives in dice.mjs#_getAutomaticCombatModifiers, right next to Impenetrable Shield's
 * own identical "Resistance = a Snag on the attack roll" check - Impenetrable Shield only reads
 * the target's OWN shield/Perk, not allies extended via Shield Upgrade, and this matches that same
 * scope rather than widening it.
 */
const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
export const SHIELD_MODULATION_ID = `${GI_JOE_CRB}16ul4Ev6b9gO5CIN`;
const SHIELD_MODULATION_FLAG_KEY = 'shieldModulationDamageType';

/**
 * Whether activating this specific Role Points item should prompt for a Shield Modulation damage
 * type first - only when it's the actor's own Personal Shield item, and they hold the Perk.
 * @param {Actor} actor
 * @param {Item} rolePoints   The Role Points item about to be activated.
 * @returns {Boolean}
 */
export function needsShieldModulationChoice(actor, rolePoints) {
  return isPersonalShieldItem(rolePoints) && actorHasPerk(actor, SHIELD_MODULATION_ID);
}

/**
 * Prompts for which damage type to modulate the shield against. Every damage type this system
 * defines is offered - the Perk's own text doesn't restrict the choice.
 * @returns {Promise<String|null>}   The chosen damage type key, or null if cancelled.
 */
export async function pickShieldModulationDamageType() {
  const options = Object.entries(E20.damageTypes)
    .map(([key, label]) => `<option value="${key}">${game.i18n.localize(label)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ShieldModulationPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ShieldModulationPickLabel')
    }</label><select name="damageType">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.damageType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Records the damage type chosen at this activation.
 * @param {Actor} actor
 * @param {String} damageType
 */
export async function setShieldModulationDamageType(actor, damageType) {
  await actor.setFlag('essence20', SHIELD_MODULATION_FLAG_KEY, damageType);
}

/**
 * Reads back the damage type chosen at the shield's last activation - stays put across
 * deactivation/reactivation until modulated again, which matches the Perk's own text (it's set
 * "when you activate," not cleared on deactivation).
 * @param {Actor} actor
 * @returns {String|null}
 */
export function getShieldModulationDamageType(actor) {
  return actor.getFlag?.('essence20', SHIELD_MODULATION_FLAG_KEY) ?? null;
}
