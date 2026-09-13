import { applyDamage } from "./combat.mjs";

/**
 * Voice of Primus (Enigma of Combination, General Perk, p.41, prerequisite Huge Size or larger):
 * "As a Standard action, you can attempt an Intimidation or Performance Skill Test against a
 * target's Willpower Defense. On a success, you deal 1 Psychic damage or impose the Frightened
 * Condition on them for 2d2 rounds."
 *
 * Only this third clause is built. "You can be heard clearly up to half a mile away" is pure
 * narrative (no range-of-hearing mechanic to hook). "You can attempt a DIF 12 Persuasion Skill
 * Test to Lend Assistance to any ally that can hear your voice" needs the still-unbuilt full Lend
 * Assistance action (only a narrow Spot-triggered slice of that action exists so far).
 *
 * The skill choice (Intimidation or Performance) is picked BEFORE the roll via a small dialog -
 * the same "don't spend anything on a cast that will be wasted" idiom Bolster Defense/Elemental
 * Storm already establish for their own pre-roll option pickers - then the target is resolved
 * (currently targeted) and a real Skill-Test-vs-Willpower roll is triggered via
 * actor._dice.rollSkill(), the same single-target Defense-vs-Defense shape Martial Leadership
 * just established. On success, a second post-hit picker (damage or Frightened) - Martial
 * Leadership's own picker shape again, just choosing between an immediate effect (damage) and a
 * Condition instead of Snag/Edge.
 */

/**
 * @returns {Promise<String|null>}   'intimidation' or 'performance', or null if cancelled.
 */
export async function pickVoiceOfPrimusSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VoiceOfPrimusPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.VoiceOfPrimusPickSkillLabel')
    }</label><select name="skill">
      <option value="intimidation">${game.i18n.localize('E20.SkillIntimidation')}</option>
      <option value="performance">${game.i18n.localize('E20.SkillPerformance')}</option>
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
 * Prompts for the skill, resolves the currently-targeted actor, and triggers the roll. The
 * effect picker only runs afterward, in dice.mjs's own post-roll success handling.
 * @param {Actor} actor
 * @returns {Promise<Actor|null|false>}   The target actor; null if there was nothing valid to
 *   target (surfaced as a warning by the caller); false if the skill picker was cancelled.
 */
export async function activateVoiceOfPrimus(actor) {
  const skill = await pickVoiceOfPrimusSkill();
  if (!skill) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  await actor._dice.rollSkill({
    skill, shiftUp: 0, shiftDown: 0, defenseType: 'willpower',
    isVoiceOfPrimusAttempt: true, voiceOfPrimusTargetUuid: targetActor.uuid,
  }, actor);
  return targetActor;
}

/**
 * @returns {Promise<String|null>}   'damage' or 'frightened', or null if cancelled.
 */
export async function pickVoiceOfPrimusEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VoiceOfPrimusPickEffectTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.VoiceOfPrimusPickEffectLabel')
    }</label><select name="effect">
      <option value="damage">${game.i18n.localize('E20.VoiceOfPrimusDamage')}</option>
      <option value="frightened">${game.i18n.localize('E20.StatusFrightened')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effect.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for and applies the chosen effect to the target - called from dice.mjs's own post-roll
 * success handling. Damage is applied directly (no attack-damage pipeline to route through, this
 * isn't a weaponEffect); Frightened is a real toggled status.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The effect applied, or null if the picker was cancelled.
 */
export async function applyVoiceOfPrimusEffect(targetActor) {
  const effect = await pickVoiceOfPrimusEffect();
  if (!effect) {
    return null;
  }

  if (effect == 'damage') {
    await applyDamage(targetActor, 1, 'psychic');
  } else {
    // "For 2d2 rounds" has no active expiry hook to roll a lifespan into (this project's own
    // established duration approximation for a Condition with a numeric printed lifespan) - a GM
    // manually clears it after that many rounds pass, the same "GM manages the edges" idiom this
    // project already uses everywhere a Condition's own printed duration can't be tracked
    // automatically.
    await targetActor.toggleStatusEffect('frightened', { active: true });
  }

  return effect;
}
