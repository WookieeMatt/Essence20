import { bankPendingBonus } from "./perks.mjs";

/**
 * Powerful Suggestions (Enigma of Combination, Counselor Focus, Scientist, 17th level, p.34): "If
 * you can hold a conversation with a target who can understand you for 30 minutes or more, you
 * can suggest a specific Skill of theirs will either excel amazingly or catastrophically fail. A
 * target that will excel amazingly turns their next Success with that Skill into a Critical
 * Success. A target destined for terrible failure suffers downshift-3 with that Skill until they
 * prove you wrong with a Critical Success using it."
 *
 * A single "Use" button dispatch (no Power/Energon cost named) opening one picker for both the
 * target Skill and which of the 2 effects to suggest, banking `{skill, effect}` directly on the
 * TARGET (not the caster) via the generic bankPendingBonus/getPendingBonus/clearPendingBonus
 * machinery every other banked-on-target flag in this project already uses. "30 minutes" is
 * dropped as an unenforceable narrative precondition.
 *
 * Both effects are consumed in dice.mjs, not here. "Critical Success" for a plain Skill Test is
 * this system's own Degrees-of-Success concept (beating the Difficulty by double, i.e.
 * computeMultiplier() returning >= 2) - the same number Devastating Strike's own "double becomes
 * triple" clause already keys off - NOT the separate weapon-attack-only "natural max die" isCrit
 * concept from Combat p.205 (which only ever drives criticalOptions' attack-effect-stacking,
 * gated on there being a damageValue at all): "excel" bumps a marginal Success (multiplier 1) up
 * to a Critical Success (multiplier 2) outright, in _rollSkillHelper's own results.map(); "fail"
 * is a flat downshift-3 applied in rollSkill's own shift computation (see PSYCH_101_ID's neighbor
 * check), self-clearing the moment the target achieves a genuine Critical Success (multiplier >=
 * 2) with that Skill on their own.
 */
export const POWERFUL_SUGGESTION_FLAG = 'pendingPowerfulSuggestion';

/**
 * @returns {Promise<{skill: String, effect: String}|null>}   effect is 'excel' or 'fail'.
 */
export async function pickPowerfulSuggestionOptions() {
  const skillOptions = Object.keys(CONFIG.E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(CONFIG.E20.skills[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PowerfulSuggestionsPickOptionsTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PowerfulSuggestionsPickSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.PowerfulSuggestionsPickEffectLabel')
}</label><select name="effect">
      <option value="excel">${game.i18n.localize('E20.PowerfulSuggestionsExcel')}</option>
      <option value="fail">${game.i18n.localize('E20.PowerfulSuggestionsFail')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          skill: button.form.elements.skill.value, effect: button.form.elements.effect.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Resolves the currently-targeted actor, prompts for the Skill/effect, and banks it on them.
 * @param {Actor} _actor   Unused - kept only for a consistent onPerkUse dispatch signature.
 * @returns {Promise<Actor|null|false>}
 */
export async function activatePowerfulSuggestions(_actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  const options = await pickPowerfulSuggestionOptions();
  if (!options) {
    return false;
  }

  await bankPendingBonus(targetActor, POWERFUL_SUGGESTION_FLAG, options);
  return targetActor;
}
