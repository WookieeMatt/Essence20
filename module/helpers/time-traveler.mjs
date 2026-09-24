import { E20 } from "./config.mjs";
import { requestStoryPointSpend } from "./story-points.mjs";

/**
 * Time Traveler (A Jump Through Time, Influence Perk, p.24): "Spend 1 Story Point and choose a
 * Skill. Until the end of this scene, you cannot suffer a Snag on Skill Tests using that Skill."
 * An on/off toggle costing 1 Story Point only to switch ON (same shape as Power Boost/Dig In),
 * scoped to whichever skill was chosen at activation time rather than a fixed one - "until the end
 * of this scene" approximated as "until manually toggled off," this project's usual duration idiom
 * for a Perk with no automatic scene-boundary hook to clear itself against.
 */
export const TIME_TRAVELER_SNAG_IMMUNITY_FLAG = 'timeTravelerSnagImmuneSkill';

/**
 * @param {Actor} actor
 * @returns {String|null}   The skill currently immune to Snag, or null if the toggle is off.
 */
export function getTimeTravelerActiveSkill(actor) {
  return actor.getFlag?.('essence20', TIME_TRAVELER_SNAG_IMMUNITY_FLAG) ?? null;
}

/**
 * Prompts for which Skill to grant Snag immunity to - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill/pickHobbleCondition.
 * @returns {Promise<String|null>}
 */
async function pickTimeTravelerSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TimeTravelerPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.TimeTravelerPickSkillLabel')
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
 * Toggles Time Traveler's Snag immunity - off is free, on prompts for a Skill and spends 1 Story
 * Point (the caller, banked-buffs.mjs#canUsePerk, already gated affordability for turning it on).
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The active skill after toggling, or null if now off/cancelled.
 */
export async function toggleTimeTravelerSnagImmunity(actor) {
  if (getTimeTravelerActiveSkill(actor)) {
    await actor.unsetFlag('essence20', TIME_TRAVELER_SNAG_IMMUNITY_FLAG);
    return null;
  }

  const chosenSkill = await pickTimeTravelerSkill();
  if (!chosenSkill) {
    return null;
  }

  requestStoryPointSpend(actor, 1);
  await actor.setFlag('essence20', TIME_TRAVELER_SNAG_IMMUNITY_FLAG, chosenSkill);
  return chosenSkill;
}
