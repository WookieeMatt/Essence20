import { bankPendingBonus } from "./perks.mjs";

/**
 * Flying Nuisance (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.66): "when you fly past
 * a space adjacent to an enemy creature or vehicle, you can make an Acrobatics or Driving Skill
 * Test as a Free action to rock them. On a success, they suffer Snag on Skill Tests until the end
 * of their next turn."
 *
 * Same overall shape as Antagonistic (helpers/antagonistic.mjs) - a Free-action Skill Test against
 * a single targeted token, banking an unscoped debuff on success consumed on the target's own next
 * roll (this project's usual "until..." approximation) - except the roll is Acrobatics OR Driving
 * (the player's own choice, same single-select DialogV2 shape as
 * pickGroundSuppressionDefenseType), always Snag (no shiftDown alternative to choose between), and
 * rolled against the target's Evasion - RAW gives this Skill Test no printed Difficulty, and
 * Evasion ("dodging a flyby") is the closest existing Defense to "avoid being rocked", the same
 * "closest existing mechanism" judgment call this project already makes for other DIF-less Skill
 * Tests.
 */
export const FLYING_NUISANCE_SNAG_FLAG = 'pendingFlyingNuisanceSnag';

/**
 * Prompts for which Skill (Acrobatics or Driving) this attempt uses.
 * @returns {Promise<String|null>}   'acrobatics'/'driving', or null if cancelled.
 */
export async function pickFlyingNuisanceSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.FlyingNuisancePickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.FlyingNuisancePickSkillLabel')
    }</label><select name="skill">
      <option value="acrobatics">${game.i18n.localize('E20.SkillAcrobatics')}</option>
      <option value="driving">${game.i18n.localize('E20.SkillDriving')}</option>
    </select></div>`,
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
 * Banks the unscoped Snag on the target - see this file's own doc comment. Consumed in
 * dice.mjs's own Antagonistic-shiftDown-style unscoped-bonus block.
 * @param {Actor} targetActor
 */
export async function markFlyingNuisanceSnag(targetActor) {
  await bankPendingBonus(targetActor, FLYING_NUISANCE_SNAG_FLAG, { snag: true });
}

/**
 * Triggers the Acrobatics-or-Driving-vs-Evasion Skill Test, aimed at whichever one token the
 * player has targeted - same single-target "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape as Antagonistic/Menace.
 * @param {Actor} actor
 */
export async function activateFlyingNuisance(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.FlyingNuisanceNoTarget'));
    return;
  }

  const skill = await pickFlyingNuisanceSkill();
  if (!skill) {
    return;
  }

  await actor._dice.rollSkill({
    skill,
    essence: 'speed', // Acrobatics and Driving are both Speed-Essence skills.
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'evasion',
    isFlyingNuisance: true,
  }, actor);
}
