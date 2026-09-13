import { E20 } from "./config.mjs";
import { bankPendingBonus } from "./perks.mjs";

/**
 * Shoulder To Shoulder (GI Joe CRB, Focus: Frontline Leader, 3rd level, p.87): "when an ally
 * starts their turn adjacent to you, they gain [an upshift 1] to a skill of your choice for the
 * remainder of their turn."
 *
 * The automatic "starts their turn adjacent to you" trigger has no clean hook to fire a dialog
 * FOR the holder at the exact moment a DIFFERENT actor's turn begins (every other reactive
 * picker in this project is triggered by the deciding player's own explicit click, never an
 * unrelated actor's turn-start hook) - so this is built as a "Use" button the holder clicks
 * themselves once they notice the trigger, aimed at whichever ally is currently targeted (the
 * same "auto-detect via game.user.targets, player confirms" idiom Mark Target/Duty Of The
 * Graphite already establish, here just applied to an ally instead of an enemy). "Adjacency"
 * isn't separately enforced - the same "player picks who benefits, no geometry check" idiom
 * Plan of Action/Heart of the Team's own ally-picker already accepts.
 *
 * The chosen skill is banked on the TARGET (bankPendingBonus, same shape Ageless Knowledge's own
 * self-only skill-scoped bank already establishes, just aimed at someone else), consumed on their
 * own next roll of that skill - "for the remainder of their turn" approximated as "their next
 * matching roll," this project's usual duration idiom.
 */
export const SHOULDER_TO_SHOULDER_FLAG = 'pendingShoulderToShoulder';

/**
 * Prompts for which Skill to grant the upshift to - same single-dropdown DialogV2 shape as
 * helpers/ageless-knowledge.mjs#pickAgelessKnowledgeSkill.
 * @returns {Promise<String|null>}
 */
export async function pickShoulderToShoulderSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ShoulderToShoulderPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ShoulderToShoulderPickSkillLabel')
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
 * Banks the chosen skill's upshift on the currently-targeted ally, once a skill has actually
 * been chosen. Returns false (having banked nothing) if there's no target, or the picker is
 * cancelled.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateShoulderToShoulder(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.ShoulderToShoulderNoTarget'));
    return false;
  }

  const skill = await pickShoulderToShoulderSkill();
  if (!skill) {
    return false;
  }

  await bankPendingBonus(targetActor, SHOULDER_TO_SHOULDER_FLAG, { skill, shiftUp: 1 });
  return true;
}
