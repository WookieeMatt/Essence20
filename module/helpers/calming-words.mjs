/**
 * Calming Words (Enigma of Combination, Counselor Focus, Scientist, 3rd level, p.34): "If you
 * spend at least 30 minutes with a sentient being and succeed at a Persuasion Skill Test versus
 * their Willpower or Cleverness Defense, the target receives Resistance to Psychic damage and any
 * attacks that would impose the Frightened or Mesmerized conditions for the next 24 hours. In
 * addition, you can spend a Free action and an Energon Point to attempt the same Skill Test to
 * remove the Frightened or Mesmerized Conditions from a target."
 *
 * Two distinct triggers sharing one roll (Persuasion vs. a chosen Defense), resolved via a single
 * up-front picker (action + Defense) rather than two separate "Use" buttons: "Soothe" (the 30-
 * minute ritual, no cost, grants the buff) or "Cure" (Free action + 1 Energon, removes the
 * Conditions outright). "Spend 30 minutes" is dropped as an unenforceable narrative precondition,
 * the same idiom this project already applies to every other real-time-cost clause.
 *
 * The buff's Frightened/Mesmerized-immunity half is wired into condition-immunity.mjs's own
 * `checkFn` escape hatch (a roll-granted temporary flag, not a permanently-held Perk - same shape
 * Greased Lightning's identical flag-based immunity already established) rather than a permanent
 * Perk-driven entry. "For the next 24 hours" has no active expiry hook - the same "GM manages the
 * edges" duration idiom this project already uses for every other printed-duration grant.
 */
const BUFF_FLAG = 'calmingWordsBuffActive';

export function isCalmingWordsBuffActive(actor) {
  return !!actor?.getFlag?.('essence20', BUFF_FLAG);
}

/**
 * @returns {Promise<{action: String, defenseType: String}|null>}   action is 'soothe' or 'cure'.
 */
export async function pickCalmingWordsOptions() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.CalmingWordsPickOptionsTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.CalmingWordsPickActionLabel')
    }</label><select name="action">
      <option value="soothe">${game.i18n.localize('E20.CalmingWordsSoothe')}</option>
      <option value="cure">${game.i18n.localize('E20.CalmingWordsCure')}</option>
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
          action: button.form.elements.action.value, defenseType: button.form.elements.defenseType.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Resolves the currently-targeted actor, prompts for the action/Defense, spends the Energon cost
 * for a Cure attempt, and triggers the roll.
 * @param {Actor} actor
 * @returns {Promise<Actor|null|false|'noEnergon'>}
 */
export async function activateCalmingWords(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  const options = await pickCalmingWordsOptions();
  if (!options) {
    return false;
  }

  if (options.action == 'cure') {
    if (!(actor.system.energon?.normal?.value >= 1)) {
      return 'noEnergon';
    }

    await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  }

  await actor._dice.rollSkill({
    skill: 'persuasion', shiftUp: 0, shiftDown: 0, defenseType: options.defenseType,
    isCalmingWordsAttempt: true, calmingWordsTargetUuid: targetActor.uuid, calmingWordsAction: options.action,
  }, actor);
  return targetActor;
}

/**
 * Applies the chosen effect to the target on a successful roll - called from dice.mjs's own
 * post-roll success handling.
 * @param {Actor} targetActor
 * @param {String} action   'soothe' or 'cure'.
 */
export async function applyCalmingWordsEffect(targetActor, action) {
  if (action == 'cure') {
    await targetActor.toggleStatusEffect('frightened', { active: false });
    await targetActor.toggleStatusEffect('mesmerized', { active: false });
    return;
  }

  await targetActor.setFlag('essence20', BUFF_FLAG, true);
  await targetActor.update({ 'system.resistances.psychic': true });
}
