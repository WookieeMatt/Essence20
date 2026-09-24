import { E20 } from "./config.mjs";

/**
 * Fast Learner (GI Joe CRB, Technician/Tinkerer Focus, 1st level, p.106): "As a Standard action,
 * you can lower a Skill's rank by 1 to increase another Skill's rank by 1. You cannot decrease a
 * Skill's rank to untrained. This lasts for the duration of the Mission, or until you use Fast
 * Learner again." Unlike Ageless Knowledge/Paradox's own bank-now/consume-on-next-matching-roll
 * shape, this is a standing reallocation - it stays in effect (read fresh on every roll of either
 * skill) until the player picks a new pair or clears it, not a one-shot flag cleared after a
 * single roll. "Cannot decrease to untrained" is approximated by simply excluding a skill already
 * at the bottom-tier d2 shift from the decrease dropdown - the closest available reading of
 * "rank" for a system that tracks skills as a die shift, not a numeric rank.
 */
const FAST_LEARNER_FLAG = 'fastLearnerAllocation';

/**
 * @param {Actor} actor
 * @returns {{decreaseSkill: String, increaseSkill: String}|null}
 */
export function getFastLearnerAllocation(actor) {
  return actor.getFlag?.('essence20', FAST_LEARNER_FLAG) ?? null;
}

/**
 * Prompts for which Skill to decrease and which to increase, then stores the pair as a standing
 * actor flag (replacing any prior allocation). Skills already at the bottom-tier d2 shift are
 * excluded from the decrease dropdown.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether a new allocation was actually set.
 */
export async function pickFastLearnerAllocation(actor) {
  const rollData = actor.getRollData();
  const decreaseOptions = Object.keys(E20.skills)
    .filter(key => rollData.skills[key]?.shift != 'd2')
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const increaseOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.FastLearnerPickSkillsTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.FastLearnerDecreaseLabel')
    }</label><select name="decreaseSkill">${decreaseOptions}</select></div>` +
      `<div class="form-group"><label>${
        game.i18n.localize('E20.FastLearnerIncreaseLabel')
      }</label><select name="increaseSkill">${increaseOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          decreaseSkill: button.form.elements.decreaseSkill.value,
          increaseSkill: button.form.elements.increaseSkill.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel' || chosen.decreaseSkill == chosen.increaseSkill) {
    return false;
  }

  await actor.setFlag('essence20', FAST_LEARNER_FLAG, chosen);
  return true;
}
