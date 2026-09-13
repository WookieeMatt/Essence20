import { slugifySpecializationName, titleCaseSpecializationName } from "./utils.mjs";
import { E20 } from "./config.mjs";

/**
 * Bestow Expertise (MLP CRB, Superior Enchantment spell, p.137): "You fill a pony's mind with
 * wisdom and experience... The target pony gains a Specialization of your choice for any Skill
 * for the duration of the spell."
 *
 * The Skill and the Specialization's own name are both picked BEFORE the roll (same "don't spend
 * on a wasted cast" idiom Enchant/Bolster Defense already established) - a free-text name field,
 * since Specializations are player-named free text in this codebase, not a fixed catalog (see
 * `sheet-handlers/specialization-handler.mjs`'s own doc comment). On a successful cast, writes the
 * specialization directly onto the target's own `system.skills.<skill>.specializations` with
 * `granted: true` - the exact shape that same file's own doc comment calls out as the correct path
 * for "a Perk/Item automation that GRANTS a specialization for free," as opposed to
 * `addSpecialization()` itself, which is reserved for a player's own purchased pick. "For the
 * duration of the spell" has no active expiry hook - left in place until a GM/player manually
 * removes it via the sheet's own existing trash-icon delete, the same "approximate an
 * unenforceable duration" idiom this project uses everywhere else.
 */
export async function pickBestowExpertise() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.BestowExpertisePickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.BestowExpertiseSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div><div class="form-group"><label>${
      game.i18n.localize('E20.BestowExpertiseNameLabel')
    }</label><input type="text" name="name"/></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => (
          { skill: button.form.elements.skill.value, name: button.form.elements.name.value }
        ),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' && chosen.name?.trim() ? chosen : null;
}

/**
 * Grants the specialization on the target - called from dice.mjs's own post-roll success
 * handling.
 * @param {Actor} targetActor
 * @param {String} skill
 * @param {String} name
 */
export async function applyBestowExpertise(targetActor, skill, name) {
  const displayName = titleCaseSpecializationName(name.trim());
  const existing = targetActor.system.skills[skill]?.specializations || {};
  const key = slugifySpecializationName(displayName, existing);

  await targetActor.update({
    [`system.skills.${skill}.specializations.${key}`]: {
      name: displayName,
      shift: targetActor.system.skills[skill].shift,
      isSpecialized: true,
      edge: false,
      shiftUp: 0,
      shiftDown: 0,
      snag: false,
      granted: true,
    },
  });
}
