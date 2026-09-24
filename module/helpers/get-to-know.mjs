import { E20 } from "./config.mjs";

/**
 * Get To Know (Dark Skies Over Equestria, Elementary Utility spell, p.21): "You call upon
 * whispered rumors, newspaper headlines... You learn enough about your target to gain an Edge on
 * a Skill Test related to them."
 *
 * The related Skill is picked BEFORE the roll (same "don't spend on a wasted cast" idiom
 * Enchant/Bolster Defense already established), threaded through the cast's own synthetic dataset
 * from documents/item.mjs's own spell-cast branch. On a successful cast, banks a self-Edge scoped
 * to BOTH the chosen Skill AND the specific target researched - combining Menacing Glare's own
 * "self-Edge scoped to one specific other actor" shape with Grid Surge's own "skill-scoped" bank,
 * since RAW's own Edge only applies to Skill Tests "related to them" (the researched target), not
 * any use of that Skill.
 */
export const GET_TO_KNOW_EDGE_FLAG = 'pendingGetToKnowEdge';

/**
 * @returns {Promise<String|null>}   The chosen skill key, or null if cancelled.
 */
export async function pickGetToKnowSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.GetToKnowPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.GetToKnowPickSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.skill.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Banks the Edge on the caster, scoped to the chosen skill and target - called from dice.mjs's own
 * post-roll success handling.
 * @param {Actor} actor
 * @param {String} skill
 * @param {String} targetId
 */
export async function applyGetToKnow(actor, skill, targetId) {
  await actor.setFlag('essence20', GET_TO_KNOW_EDGE_FLAG, { skill, targetId });
}
