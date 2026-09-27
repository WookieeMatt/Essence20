import { E20 } from "./config.mjs";

/**
 * Generic choice prompting for Hang-Ups, the counterpart to perk-handler.mjs#setPerkValues' own
 * per-choiceType switch. Added 2026-09-15 for Augmented (Across the Stars, p.44), the first
 * Hang-Up in this project that has to RECORD a player choice rather than just carry a flat effect.
 *
 * Deliberately a plain DialogV2 rather than a reuse of ChoicesSelector: that application's own
 * confirm path routes straight into onPerkDrop's perk-specific plumbing (dropFunc, parentPerk,
 * per-choiceType branches), none of which applies to an already-created Hang-Up item. The
 * single-dropdown DialogV2 shape used by pickAgelessKnowledgeSkill/pickDefenseType/
 * pickHobbleCondition is exactly what's needed and carries no perk coupling.
 *
 * Only 'damageType' is offered so far. It spans the FULL E20.damageTypes list rather than the 7
 * Element sub-types E20.elementDamageTypes covers, because Augmented's own RAW points at the core
 * rulebook's complete damage type table, not the Element trait's sub-choices.
 */

/**
 * Prompts for one damage type out of the full E20.damageTypes list.
 * @returns {Promise<String|null>}
 */
export async function pickHangUpDamageType() {
  const options = Object.keys(E20.damageTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.damageTypes[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.HangUpPickDamageTypeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.HangUpPickDamageTypeLabel')
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
 * Prompts for and records a newly-created Hang-Up's own choice, if it declares one. A no-op for
 * every Hang-Up that doesn't (which is all of them but Augmented today), and a no-op on cancel -
 * the Hang-Up is still granted either way, since an Influence's mandatory Hang-Up isn't optional
 * and shouldn't be silently dropped just because the picker was dismissed.
 * @param {Item} hangUp   The Hang-Up Item already created on the Actor.
 */
export async function applyHangUpChoice(hangUp) {
  if (!hangUp?.system?.hasChoice || hangUp.system.choiceType != 'damageType') {
    return;
  }

  const chosen = await pickHangUpDamageType();
  if (chosen) {
    await hangUp.update({ 'system.choice': chosen });
  }
}
