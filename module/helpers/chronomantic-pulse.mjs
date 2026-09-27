/**
 * Chronomantic Pulse (Finster's Monster-Magic Cookbook, Sorcerous Power, p.273): "DIF 12 Culture
 * (Arcane) Skill Test as a Standard action to determine where in the Initiative Order a target
 * within 20ft of you is placed; automatically succeeds against a willing target."
 *
 * Same "prompt for the option BEFORE the roll, thread it through the synthetic dataset, apply it
 * in dice.mjs's own post-roll success handling" shape as Bolster Defense (helpers/bolster-
 * defense.mjs) - the option here is the target's new Initiative VALUE rather than a Defense
 * choice, written directly to Combatant#initiative, the same field Right Behind You/Splinter
 * Defense already establish writing to. RAW's own "determine where...is placed" is open-ended (any
 * position at all, unlike Right Behind You's fixed "immediately after an ally"), so rather than
 * inventing a drag-and-drop reordering UI, the caster is simply asked for the initiative NUMBER
 * they want the target to have - the same result any placement in the order ultimately comes down
 * to, and lets them slot the target between two existing entries by picking a value between their
 * scores.
 *
 * "A willing target" is approximated as an ally (same Disposition as the caster, or the caster
 * themselves) - this codebase has no other "willing" concept anywhere - in which case the DIF 12
 * roll is skipped entirely and the placement just happens, the same "no roll needed against a
 * cooperative target" idiom Foolscarrot/Bestow Expertise's own willing-target spells already
 * accept implicitly (no Defense/opposed check at all for an ally-only effect).
 */

/**
 * Prompts for the desired Initiative value.
 * @returns {Promise<Number|null>}   null if cancelled or not a valid number.
 */
async function pickChronomanticPulseInitiative() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ChronomanticPulsePickInitiativeTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ChronomanticPulsePickInitiativeLabel')
    }</label><input type="number" name="initiative" step="0.01" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.initiative.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel' || chosen === '') {
    return null;
  }

  const value = Number(chosen);
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether the given target counts as "willing" - an ally of the caster, or the caster themselves.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
function isWillingChronomanticPulseTarget(actor, targetActor) {
  if (targetActor === actor || (actor.id != null && targetActor.id == actor.id)) {
    return true;
  }

  const actorToken = actor.getActiveTokens?.()?.[0];
  const targetToken = targetActor.getActiveTokens?.()?.[0];
  return !!actorToken && !!targetToken && actorToken.document.disposition === targetToken.document.disposition;
}

/**
 * Prompts for the desired Initiative value and resolves the target (currently targeted, or self),
 * then either applies it directly (a willing target) or triggers the DIF 12 Culture (Arcane) roll
 * whose post-roll success handling (dice.mjs) applies it instead.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False if the picker was cancelled.
 */
export async function activateChronomanticPulse(actor) {
  const initiative = await pickChronomanticPulseInitiative();
  if (initiative === null) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor ?? actor;

  if (isWillingChronomanticPulseTarget(actor, targetActor)) {
    await applyChronomanticPulse(targetActor, initiative);
    return true;
  }

  await actor._dice.rollSkill({
    skill: 'culture', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12',
    isChronomanticPulseAttempt: true, chronomanticPulseInitiative: initiative, chronomanticPulseTargetUuid: targetActor.uuid,
  }, actor);
  return true;
}

/**
 * Writes the new Initiative value directly onto the target's current Combatant, if it has one.
 * @param {Actor} targetActor
 * @param {Number} initiative
 */
export async function applyChronomanticPulse(targetActor, initiative) {
  const combatant = game.combat?.combatants.find(c => c.actor?.id == targetActor.id);
  if (combatant) {
    await combatant.update({ initiative });
  }
}
