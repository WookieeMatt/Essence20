import { applyDamage } from "./combat.mjs";
import { bankPendingBonus, clearPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Voice of Primus (Enigma of Combination, General Perk, p.41, prerequisite Huge Size or larger):
 * "First, you can be heard clearly, if you wish, up to a half a mile away. Second, you can attempt
 * a DIF 12 Persuasion Skill Test to Lend Assistance to any ally that can hear your voice. Finally,
 * as a Standard action, you can attempt an Intimidation or Performance Skill Test against a
 * target's Willpower Defense. On a success, you deal 1 Psychic damage or impose the Frightened
 * Condition on them for 2d2 rounds."
 *
 * "You can be heard clearly up to half a mile away" is pure narrative (no range-of-hearing
 * mechanic to hook) - it's already effectively covered anyway, since activateLendAssistance's own
 * ally list is unlimited-range (see lend-assistance.mjs's own doc comment).
 *
 * Both mechanical clauses share this Perk's one Use button, so there is one initial mode picker
 * (pickVoiceOfPrimusMode) rather than jumping straight to the attack's own skill picker - the same
 * "one Item, one button, so the button asks which clause" reasoning Heroic Intervention's own
 * comment (helpers/banked-buffs.mjs) already established, just via an explicit choice here instead
 * of a natural "already used" fallthrough, since neither clause has a usage cap to fall through on.
 *
 * ATTACK mode: the skill choice (Intimidation or Performance) is picked BEFORE the roll via a
 * small dialog - the same "don't spend anything on a cast that will be wasted" idiom Bolster
 * Defense/Elemental Storm already establish for their own pre-roll option pickers - then the
 * target is resolved (currently targeted) and a real Skill-Test-vs-Willpower roll is triggered via
 * actor._dice.rollSkill(), the same single-target Defense-vs-Defense shape Martial Leadership
 * just established. On success, a second post-hit picker (damage or Frightened) - Martial
 * Leadership's own picker shape again, just choosing between an immediate effect (damage) and a
 * Condition instead of Snag/Edge.
 *
 * ASSIST mode: a flat DIF 12 Persuasion Skill Test (activateVoiceOfPrimusAssist), the same flat-
 * Difficulty pipeline Consummate Performer's own roll uses. On success, dice.mjs's own post-roll
 * handling banks a pending flag (isVoiceOfPrimusAssistReady) rather than immediately opening the
 * Lend Assistance picker itself - the roll and the assist are two separate actions in RAW ("attempt
 * a... Skill Test to Lend Assistance", read as a prerequisite roll, not the action itself), so the
 * player takes the ordinary Lend Assistance action afterward (already reachable to everyone via
 * helpers/named-actions.mjs) and canAssistWithSkill's own bypass check picks the flag up from
 * there, consumed the moment it actually lets an otherwise-unqualified assist through.
 */

/**
 * @returns {Promise<String|null>}   'intimidation' or 'performance', or null if cancelled.
 */
export async function pickVoiceOfPrimusSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VoiceOfPrimusPickSkillTitle') },
    classes: ["window-app", "e20-window"],
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
async function activateVoiceOfPrimusAttack(actor) {
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

/** @returns {Promise<String|null>}   'attack' or 'assist', or null if cancelled. */
export async function pickVoiceOfPrimusMode() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VoiceOfPrimusPickModeTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.VoiceOfPrimusPickModeLabel')
    }</label><select name="mode">
      <option value="attack">${game.i18n.localize('E20.VoiceOfPrimusModeAttack')}</option>
      <option value="assist">${game.i18n.localize('E20.VoiceOfPrimusModeAssist')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.mode.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * The one Use button's real entry point - asks which of the two clauses to take, then dispatches.
 * @param {Actor} actor
 * @returns {Promise<Actor|null|false|true>}   The attack's own target actor (or null/false, see
 *   activateVoiceOfPrimusAttack above); true for a completed assist roll; false if the mode picker
 *   itself was cancelled.
 */
export async function activateVoiceOfPrimus(actor) {
  const mode = await pickVoiceOfPrimusMode();
  if (!mode) {
    return false;
  }

  if (mode == 'assist') {
    await activateVoiceOfPrimusAssist(actor);
    return true;
  }

  return activateVoiceOfPrimusAttack(actor);
}

const VOICE_OF_PRIMUS_ASSIST_FLAG = 'voiceOfPrimusAssistReady';

/**
 * The assist half: a flat DIF 12 Persuasion Skill Test. Success is banked
 * (isVoiceOfPrimusAssistReady) rather than acted on immediately - see this file's own doc comment
 * for why the roll and the Lend Assistance action itself stay two separate steps.
 * @param {Actor} actor
 */
export async function activateVoiceOfPrimusAssist(actor) {
  await actor._dice.rollSkill({
    skill: 'persuasion', shiftUp: 0, shiftDown: 0, dif: '12', isVoiceOfPrimusAssistAttempt: true,
  }, actor);
}

/**
 * Called from dice.mjs's own post-roll success handling for a successful assist attempt.
 * @param {Actor} actor
 */
export async function bankVoiceOfPrimusAssistReady(actor) {
  await bankPendingBonus(actor, VOICE_OF_PRIMUS_ASSIST_FLAG, {});
}

/**
 * Whether this actor currently has a live, unspent DIF 12 Persuasion success banked - see
 * helpers/lend-assistance.mjs's own canAssistWithSkill, the one caller.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasVoiceOfPrimusAssistReady(actor) {
  return !!getPendingBonus(actor, VOICE_OF_PRIMUS_ASSIST_FLAG);
}

/**
 * Consumes the banked roll once it's actually let an assist through - see lend-assistance.mjs's
 * own bankSkillAssist, the one caller.
 * @param {Actor} actor
 */
export async function clearVoiceOfPrimusAssistReady(actor) {
  await clearPendingBonus(actor, VOICE_OF_PRIMUS_ASSIST_FLAG);
}

/**
 * @returns {Promise<String|null>}   'damage' or 'frightened', or null if cancelled.
 */
export async function pickVoiceOfPrimusEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.VoiceOfPrimusPickEffectTitle') },
    classes: ["window-app", "e20-window"],
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
