/**
 * Trigger Reaction (General Hawk's Personnel Files, General Perk, p.174, prerequisite Science or
 * Survival +d8): "As a Standard action, make a DIF 5 Science or Survival Skill Test. On a success,
 * you learn one way that you can use your weapons in the environment for an additional effect
 * other than a damaging effect. You learn one additional way for every 5 by which your result
 * beats the DIF."
 *
 * RE-CATEGORIZED - this item's own name ("Trigger Reaction") reads as a reactive/interrupt
 * mechanic, but the real RAW text is a plain proactive Standard-action Skill Test with a purely
 * narrative payoff (how many environmental tricks the player discovers, each GM-adjudicated) - no
 * frequency cap, no post-roll handler needed. The same shape "I Know A Guy" already established
 * (helpers/i-know-a-guy.mjs's own doc comment): the roll's own standard chat card already reports
 * success and by how much, which is all a GM needs to count out "one additional way per 5 over the
 * DIF." The only new piece here is the skill CHOICE (Science or Survival, both Smarts-essence, so
 * no essence branching needed) - Mind Over Matter's own skill-picker dialog shape, minus its amount
 * field since this Perk has none.
 */
export const TRIGGER_REACTION_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.PItQuRGhxq4lMT3P";

/**
 * @returns {Promise<String|null>}   'science'/'survival', or null if cancelled.
 */
async function pickTriggerReactionSkill() {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TriggerReactionPickTitle') },
    classes: ["window-app"],
    content: `
      <div class="form-group"><label>${game.i18n.localize('E20.TriggerReactionSkillLabel')}</label>
        <select name="skill">
          <option value="science">${game.i18n.localize('E20.SkillScience')}</option>
          <option value="survival">${game.i18n.localize('E20.SkillSurvival')}</option>
        </select></div>
    `,
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

  return (result && result != 'cancel') ? result : null;
}

/**
 * Prompts for a skill, then triggers a real DIF 5 Skill Test - the roll's own chat card is the
 * complete build, same as "I Know A Guy" (see this file's own doc comment).
 * @param {Actor} actor
 */
export async function activateTriggerReaction(actor) {
  const skill = await pickTriggerReactionSkill();
  if (!skill) {
    return;
  }

  await actor._dice.rollSkill({ skill, essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '5' }, actor);
}
