import { E20 } from "./config.mjs";

/**
 * Versatile Protection (Cobra Codex, Vanguard Citystriker Focus, 17th level, p.68): "You can gain
 * Resistance to one type of damage other than Blunt and Sharp until the beginning of your next
 * turn as a Free action, or Immunity to one type of damage other than Blunt and Sharp until the
 * beginning of your next turn as a Move action. You can gain Resistance to Blunt and Sharp damage
 * as a Move action, or Immunity to Blunt and Sharp damage as a Standard action."
 *
 * All 4 tier combinations (any type + Resistance/Immunity, or Blunt/Sharp + Resistance/Immunity)
 * are available to the player - RAW only varies the ACTION COST between them, which this codebase
 * has no action-economy tracking to enforce anyway (an already-established, accepted gap). So the
 * real choice this needs is just "which damage type, Resistance or Immunity" - a single combined
 * picker, then a toggle against the confirmed-real system.resistances.<type>/immunities.<type>
 * schema (same idiom Standing the Heat's own fire-resistance AE already uses, just player-timed
 * instead of permanent). "Until the beginning of your next turn" is approximated as "until
 * switched back off manually" - this project's usual duration idiom for a self-managed toggle
 * (Dig In, Resilient Armor, etc.), since no turn-start auto-revert hook is wired to this Perk.
 */

const VERSATILE_PROTECTION_FLAG = 'versatileProtectionGrant';

export function isVersatileProtectionActive(actor) {
  return !!actor.getFlag?.('essence20', VERSATILE_PROTECTION_FLAG);
}

/**
 * Prompts for which damage type and tier (Resistance/Immunity) to grant.
 * @returns {Promise<{damageType: String, tier: String}|null>}
 */
export async function pickVersatileProtection() {
  const options = Object.keys(E20.damageTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VersatileProtectionPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.VersatileProtectionDamageTypeLabel')
    }</label><select name="damageType">${options}</select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.VersatileProtectionTierLabel')
}</label><select name="tier">
      <option value="resistance">${game.i18n.localize('E20.VersatileProtectionResistance')}</option>
      <option value="immunity">${game.i18n.localize('E20.VersatileProtectionImmunity')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({ damageType: button.form.elements.damageType.value, tier: button.form.elements.tier.value }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Toggles Versatile Protection - switching ON prompts for damage type/tier and sets the matching
 * Resistance/Immunity field; switching OFF clears exactly the field that was granted.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new active state, or null if the picker was cancelled.
 */
export async function toggleVersatileProtection(actor) {
  if (isVersatileProtectionActive(actor)) {
    const grant = actor.getFlag('essence20', VERSATILE_PROTECTION_FLAG);
    const field = grant.tier == 'immunity' ? 'immunities' : 'resistances';
    await actor.update({ [`system.${field}.${grant.damageType}`]: false });
    await actor.unsetFlag('essence20', VERSATILE_PROTECTION_FLAG);
    return false;
  }

  const grant = await pickVersatileProtection();
  if (!grant) {
    return null;
  }

  const field = grant.tier == 'immunity' ? 'immunities' : 'resistances';
  await actor.update({ [`system.${field}.${grant.damageType}`]: true });
  await actor.setFlag('essence20', VERSATILE_PROTECTION_FLAG, grant);
  return true;
}
