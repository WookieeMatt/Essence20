import { E20 } from "./config.mjs";

/**
 * Ageless Knowledge (Across the Stars, Phantom Ranger, 6th level, p.61): "By spending 1 Personal
 * Power and a Free action... you may remove the unskilled penalty from any single Skill Test for
 * 1 minute." "Unskilled" here isn't a flag anywhere in this codebase - it's simply rolling the
 * bottom-tier `d2` skill die (E20.skillRollableShifts). Banked scoped to one chosen skill (same
 * shape as Grid Surge's Temporary Construct), consumed on the actor's own next roll of that skill
 * by flooring its die at `d4` instead of `d2` (see dice.mjs#rollSkill's own initialShift
 * computation) - "for 1 minute" approximated as "the next matching roll," this project's usual
 * duration idiom.
 */
export const AGELESS_KNOWLEDGE_FLAG = 'pendingAgelessKnowledge';

/**
 * Prompts for which Skill to remove the unskilled penalty from - same single-dropdown DialogV2
 * shape as pickHobbleCondition/pickDefenseType.
 * @returns {Promise<String|null>}
 */
export async function pickAgelessKnowledgeSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.AgelessKnowledgePickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.AgelessKnowledgePickSkillLabel')
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
