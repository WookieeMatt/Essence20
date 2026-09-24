import { applyDamage } from "./combat.mjs";

/**
 * Words Can Hurt! (Enigma of Combination, Counselor Focus, Scientist, 6th level, p.34): "Spend a
 * Move action to study a living target, allowing you to make a special attack against that
 * creature. As a Standard action, attempt a Performance or Persuasion Skill Test against the
 * target's Willpower or Cleverness Defense... On a success, the target takes either 1 Psychic
 * damage or gains the Frightened Condition for 2d2 rounds (your choice). The target becomes
 * immune to this attack for the remainder of the scene when you succeed or if you Fumble."
 *
 * Same overall shape as helpers/voice-of-primus.mjs (skill picked up front, a real Skill-Test-vs-
 * Defense roll triggered via actor._dice.rollSkill(), a post-hit damage-or-Frightened picker), but
 * widened for a SECOND up-front choice (which Defense to target - Willpower or Cleverness, not
 * fixed like Voice of Primus's own Willpower-only clause) and a per-target once-per-scene
 * immunity flag. "Spend a Move action to study" is dropped as an unenforceable action-economy
 * precondition (this project's own established idiom) - the "Use" button triggers the Standard-
 * action attack directly. Only the success half of "succeed or Fumble" marks the target immune -
 * detecting a natural Fumble on a plain (non-weaponEffect) Skill Test isn't exposed anywhere this
 * hook can cheaply read, a documented minor gap rather than a forced guess.
 */
const IMMUNITY_FLAG = 'wordsCanHurtImmune';

export function isImmuneToWordsCanHurt(targetActor) {
  return !!targetActor.getFlag?.('essence20', IMMUNITY_FLAG);
}

/**
 * @returns {Promise<{skill: String, defenseType: String}|null>}
 */
export async function pickWordsCanHurtOptions() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.WordsCanHurtPickOptionsTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.WordsCanHurtPickSkillLabel')
    }</label><select name="skill">
      <option value="performance">${game.i18n.localize('E20.SkillPerformance')}</option>
      <option value="persuasion">${game.i18n.localize('E20.SkillPersuasion')}</option>
    </select></div>
    <div class="form-group"><label>${
  game.i18n.localize('E20.WordsCanHurtPickDefenseLabel')
}</label><select name="defenseType">
      <option value="willpower">${game.i18n.localize('E20.DefenseWillpower')}</option>
      <option value="cleverness">${game.i18n.localize('E20.DefenseCleverness')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          skill: button.form.elements.skill.value, defenseType: button.form.elements.defenseType.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Resolves the currently-targeted actor, checks their own once-per-scene immunity, prompts for
 * the skill/Defense, and triggers the roll.
 * @param {Actor} actor
 * @returns {Promise<Actor|null|false|'immune'>}
 */
export async function activateWordsCanHurt(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  if (isImmuneToWordsCanHurt(targetActor)) {
    return 'immune';
  }

  const options = await pickWordsCanHurtOptions();
  if (!options) {
    return false;
  }

  await actor._dice.rollSkill({
    skill: options.skill, shiftUp: 0, shiftDown: 0, defenseType: options.defenseType,
    isWordsCanHurtAttempt: true, wordsCanHurtTargetUuid: targetActor.uuid,
  }, actor);
  return targetActor;
}

/**
 * @returns {Promise<String|null>}   'damage' or 'frightened', or null if cancelled.
 */
export async function pickWordsCanHurtEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.WordsCanHurtPickEffectTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.WordsCanHurtPickEffectLabel')
    }</label><select name="effect">
      <option value="damage">${game.i18n.localize('E20.WordsCanHurtDamage')}</option>
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
 * Marks the target immune for the remainder of the scene, then prompts for and applies the
 * chosen effect - called from dice.mjs's own post-roll success handling.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The effect applied, or null if the picker was cancelled.
 */
export async function applyWordsCanHurtEffect(targetActor) {
  await targetActor.setFlag('essence20', IMMUNITY_FLAG, true);

  const effect = await pickWordsCanHurtEffect();
  if (!effect) {
    return null;
  }

  if (effect == 'damage') {
    await applyDamage(targetActor, 1, 'psychic');
  } else {
    // "For 2d2 rounds" has no active expiry hook - the same "GM manages the edges" duration
    // idiom this project already uses for every other Condition with a printed numeric lifespan.
    await targetActor.toggleStatusEffect('frightened', { active: true });
  }

  return effect;
}
