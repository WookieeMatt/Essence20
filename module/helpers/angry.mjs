import { E20 } from "./config.mjs";
import { bankPendingBonus, findHangUp } from "./perks.mjs";

/**
 * Angry Influence (Cobra Codex, p.26) Hang-Up: "When you use your Angry Influence Perk, you
 * suffer Snag on a single Smarts- or Social-based skill for the rest of the scene. The GM chooses
 * the skill, but you must have invested at least 1 Skill Point in that skill." See ANGRY_ID's own
 * comment in dice.mjs for why the GM's own choice is offered to the player as a picker instead.
 * "Invested at least 1 Skill Point" is approximated as the skill's own shift not being the
 * untrained default (d20) - the closest stat this system tracks for "have I put a point here."
 */

const SMARTS_SOCIAL_SKILLS = Object.keys(E20.skillToEssence)
  .filter(skill => ['smarts', 'social'].includes(E20.skillToEssence[skill]));

/**
 * Prompts for which of the actor's own trained Smarts/Social skills suffers the Angry Hang-Up's
 * Snag. Returns null (nothing to pick, or picker cancelled) rather than forcing a choice when the
 * actor has no eligible skill at all.
 * @param {Actor} actor
 * @returns {Promise<String|null>}
 */
export async function pickAngryHangUpSkill(actor) {
  const eligibleSkills = SMARTS_SOCIAL_SKILLS
    .filter(skill => actor.system.skills[skill] && actor.system.skills[skill].shift != 'd20');
  if (!eligibleSkills.length) {
    return null;
  }

  const options = eligibleSkills
    .map(skill => `<option value="${skill}">${game.i18n.localize(E20.skills[skill])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.AngryHangUpPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.AngryHangUpPickSkillLabel')
    }</label><select name="skill">${options}</select></div>`,
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
 * Prompts for and banks the Angry Hang-Up's Snag on whichever skill is chosen. A no-op (nothing
 * banked) if the actor has no Hang-Up item or no eligible skill.
 * @param {Actor} actor
 * @param {String} hangUpId
 * @returns {Promise<void>}
 */
export async function applyAngryHangUp(actor, hangUpId) {
  if (!findHangUp(actor, hangUpId)) {
    return;
  }

  const skill = await pickAngryHangUpSkill(actor);
  if (!skill) {
    return;
  }

  await bankPendingBonus(actor, 'pendingAngrySnag', { skill });
}
