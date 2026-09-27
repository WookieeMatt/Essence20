import { E20 } from "./config.mjs";
import { findPerk } from "./perks.mjs";

/**
 * Resolves the Ledger's own "choiceType:'specialization' doesn't exist" gap - every existing
 * choiceType (skills/senses/movement/perks/etc.) picks from a FIXED, pre-known list, but a
 * Specialization is a free-text name the player invents themselves (see the specialization
 * redesign - system.skills.<skill>.specializations has no fixed catalog to populate a <select>
 * with), so this is a bespoke text-input picker rather than another case in perk-handler.mjs's own
 * choiceType switch (which only ever builds enumerated `choices` objects for ChoicesSelector).
 *
 * Shape confirmed identical across all 5 of TF CRB's own Influence Perks that need this (Former
 * Senator, Gladiator, Hunter, Racer, Scavenger, p.33-38): "Choose a [Skill] Specialization,
 * whether or not you invested in that Specialization. You gain an Edge on Skill Tests when that
 * Specialization comes into play." Dispatched from perk-handler.mjs#setPerkValues at drop time
 * (same shape as Zord Alteration/Unique Strike's own bespoke pickers), storing the choice as a
 * single encoded string ("skill::name") in the Perk's own system.choice field (a plain string
 * field with no room for a structured value - same "flatten into one key" idiom Defensive
 * Flexibility's own option list already established).
 *
 * Only the "actually rolling with that Specialization selected" half is built - RAW's own "whether
 * or not you invested in it" clause (an Edge even when the player hasn't mechanically taken that
 * Specialization at all) has no narrative-trigger detection to verify and is left unenforced, the
 * same accepted simplification this project already applies to comparably unverifiable narrative
 * qualifiers elsewhere (e.g. Bits To Spare/Truthseeker).
 */
export async function pickChosenSpecialization(perkName, skillOptions) {
  const skillField = skillOptions.length > 1
    ? `<div class="form-group"><label>${
      game.i18n.localize('E20.ChosenSpecializationSkill')
    }</label><select name="skill">${
      skillOptions.map(skill => `<option value="${skill}">${game.i18n.localize(E20.skills[skill])}</option>`).join('')
    }</select></div>`
    : '';

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: perkName },
    classes: ["window-app"],
    content: `${skillField}<div class="form-group"><label>${
      game.i18n.localize('E20.ChosenSpecializationName')
    }</label><input type="text" name="name" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          skill: button.form.elements.skill?.value ?? skillOptions[0],
          name: button.form.elements.name.value?.trim(),
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return result && result != 'cancel' && result.name ? result : null;
}

/**
 * @param {Item} perkItem   The freshly-granted Perk instance to record the choice onto.
 * @param {String[]} skillOptions   The skill(s) RAW allows for this specific Perk (most name just
 *   one; Former Senator alone offers a 2-way choice between Deception and Persuasion).
 */
export async function grantChosenSpecialization(perkItem, skillOptions) {
  const chosen = await pickChosenSpecialization(perkItem.name, skillOptions);
  if (!chosen) {
    return;
  }

  await perkItem.update({ 'system.choice': `${chosen.skill}::${chosen.name}` });
}

/**
 * @param {Actor} actor
 * @param {String} perkId
 * @param {String} rolledSkill
 * @param {String} [specializationName]   The specific Specialization actually being rolled with
 *   (actor.system.skills.<skill>.specializations.<key>.name at the roll's own dataset.specializationKey),
 *   or undefined for a plain, unspecialized roll.
 * @returns {Boolean}
 */
export function hasMatchingChosenSpecialization(actor, perkId, rolledSkill, specializationName) {
  if (!specializationName) {
    return false;
  }

  const choice = findPerk(actor, perkId)?.system.choice;
  if (!choice) {
    return false;
  }

  const [skill, name] = choice.split('::');
  return skill == rolledSkill && !!name && name.toLowerCase() == specializationName.toLowerCase();
}
