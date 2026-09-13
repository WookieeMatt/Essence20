import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Hearty Meal (General Hawk's Personnel Files, General Perk, p.174): "Outside of combat, you can
 * take 10 minutes to turn MREs into a healthy and delicious meal large enough to serve your whole
 * squad. If you succeed at a DIF 15 Culture or Performance Skill Test, everyone who partakes in
 * your cooking gains 1 temporary Health."
 *
 * Same "no click-to-place target, dispatch straight into the interactive Roll Options Dialog"
 * shape as Forward Observation - see its own doc comment - but RAW offers a genuine choice of
 * skill (Culture OR Performance), unlike Forward Observation's single named skill, so this prompts
 * for it first via the same single-dropdown DialogV2 shape as pickAgelessKnowledgeSkill/
 * pickDefenseType. Culture is a Smarts skill and Performance a Social one (E20.skillEssences), so
 * the essence travels with the choice rather than being fixed.
 *
 * "Additionally, once per mission, you can use Culture or Performance in place of Science Skill
 * Tests to heal damage outside of combat" is NOT built - unlike Ever Vigilant/Needle Drop's own
 * skill substitution (which redirects a REAL existing roll, Initiative), there is no "heal via
 * Science outside combat" action anywhere in this codebase to substitute into (confirmed via
 * grep) - narrative healing via Science has no distinct code path at all, so there's nothing to
 * redirect. Flagged as a real gap, not silently dropped.
 */
const SKILL_OPTIONS = { culture: 'smarts', performance: 'social' };

/**
 * Prompts for Culture or Performance - see this file's own doc comment.
 * @returns {Promise<{skill: String, essence: String}|null>}
 */
export async function pickHeartyMealSkill() {
  const options = Object.entries(SKILL_OPTIONS)
    .map(([skill]) => `<option value="${skill}">${game.i18n.localize(`E20.Skill${skill.charAt(0).toUpperCase()}${skill.slice(1)}`)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.HeartyMealPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.HeartyMealPickSkillLabel')
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

  return chosen && chosen != 'cancel' ? { skill: chosen, essence: SKILL_OPTIONS[chosen] } : null;
}

/**
 * Prompts for the skill, then triggers the flat-DIF 15 check - see this file's own doc comment.
 * @param {Actor} actor
 */
export async function activateHeartyMeal(actor) {
  const choice = await pickHeartyMealSkill();
  if (!choice) {
    return;
  }

  await actor._dice.rollSkill(
    { skill: choice.skill, essence: choice.essence, dif: 15, isHeartyMeal: true }, actor,
  );
}

/**
 * Grants 1 temporary Health to the cook and every nearby ally, called from dice.mjs's own post-hit
 * processing once the DIF 15 Skill Test above succeeds. "Your whole squad" has no distance stated
 * in RAW, so this uses the same Infinity-radius "any ally on the scene" approximation Tourniquet
 * Line Chef/MacGyver's own identical wording already established.
 * @param {Actor} actor
 */
export async function broadcastHeartyMeal(actor) {
  const nearbyAllies = getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean);
  for (const target of [actor, ...nearbyAllies]) {
    await target.update({ 'system.health.bonus': (target.system.health.bonus ?? 0) + 1 });
  }
}
