import { E20 } from "./config.mjs";

/**
 * Talk Them Up (Field Guide to Action & Adventure, Envoy Role Perk, 16th level, p.68): "you can
 * remove one Condition (other than Defeated) as a Standard action with a successful DIF 10
 * Deception, Intimidation, or Persuasion Skill Test."
 *
 * Same flat-DIF, single-target, threaded-targetUuid shape as Breaking Point (helpers/
 * breaking-point.mjs) - the target is read from game.user.targets.first() at activation time and
 * carried through to the post-success removal below, since dice.mjs's own flat-DIF checkEntries
 * fallback builds no targetUuid of its own for a non-defenseType roll. RAW offers a choice of 3
 * skills; this always uses Persuasion, the same "pick one of the offered equivalent options"
 * default Manipulate's own doc comment already establishes.
 */
export async function activateTalkThemUp(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.TalkThemUpNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'persuasion',
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    dif: 10,
    isTalkThemUp: true,
    talkThemUpTargetUuid: targetActor.uuid,
  }, actor);
}

/**
 * Prompts for which of the target's own active Conditions (other than Defeated) to remove.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The chosen status id, or null if there was nothing to remove
 *   or the picker was dismissed.
 */
export async function pickTalkThemUpCondition(targetActor) {
  const removable = [...(targetActor.statuses ?? [])].filter(status => status != 'defeated');
  if (!removable.length) {
    ui.notifications.warn(game.i18n.localize('E20.TalkThemUpNoCondition'));
    return null;
  }

  const options = removable
    .map(status => {
      const labelKey = E20.statusEffects?.find(entry => entry.id == status)?.name ?? status;
      return `<option value="${status}">${game.i18n.localize(labelKey)}</option>`;
    })
    .join('');

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TalkThemUpTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.TalkThemUpPickCondition')
    }</label><select name="status">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.status.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Removes the chosen Condition from the target, called from dice.mjs's own post-hit processing
 * once the DIF 10 Skill Test above succeeds.
 * @param {Actor} targetActor
 */
export async function applyTalkThemUp(targetActor) {
  const status = await pickTalkThemUpCondition(targetActor);
  if (status) {
    await targetActor.toggleStatusEffect(status, { active: false });
  }
}
