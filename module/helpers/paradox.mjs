import { E20 } from "./config.mjs";

/**
 * Paradox (A Jump Through Time, Influence Perk, p.21): "Once per session, you may choose a Skill
 * and act as if you are one Skill Rank higher in that Skill until the end of the scene (max of
 * d12)." Same shape as Ageless Knowledge: prompt for a Skill at click-time, bank a shiftUp on it,
 * consumed on the next matching roll - "until the end of the scene" approximated as "the next
 * matching roll," this project's usual duration idiom, and "once per session" approximated as
 * once per encounter, matching every other daily/session-scoped resource in this project. The
 * "max of d12" cap needs no explicit clamp - _getFinalShift's own shift-list lookup already tops
 * out at d12, the same way every other shiftUp in this codebase is naturally capped.
 */
export const PARADOX_FLAG = 'pendingParadox';

/**
 * Prompts for which Skill to raise a Rank - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill/pickHobbleCondition.
 * @returns {Promise<String|null>}
 */
export async function pickParadoxSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ParadoxPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ParadoxPickSkillLabel')
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
