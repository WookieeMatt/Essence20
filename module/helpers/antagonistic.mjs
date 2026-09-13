import { bankPendingBonus } from "./perks.mjs";

/**
 * Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63): "As a Free action,
 * you can make an Intimidation Skill Test against a target's Cleverness. On a success, they
 * suffer shiftDown 1 on Skill Tests on their next turn, or Snag on attacks that target you (your
 * choice)."
 *
 * The roll itself (Intimidation vs. a manually-chosen Cleverness Defense) is already fully
 * generic. What this file adds: the post-success 2-way choice (pickAntagonisticEffect, same
 * single-select DialogV2 shape as pickMenacingGlareEffect) and applying it:
 * - shiftDown is banked on the TARGET, unscoped (pendingAntagonisticShiftDown), consumed on their
 *   own next roll of any kind - same unscoped shape as Distracting Offer's own shiftDown.
 * - Snag is banked on the TARGET too, but scoped to a specific BENEFICIARY (the Antagonistic
 *   user's own id) - the mirror image of Menacing Glare's own "self-Edge scoped to one specific
 *   other actor," just banked on the debuffed creature instead of the caster, and a Snag they
 *   suffer only when attacking that one specific person. Consumed in
 *   dice.mjs#_getAutomaticCombatModifiers's per-target block (checked as the ROLLER's own pending
 *   flag against the CURRENT target's id, same structural shape as Menacing Glare's Edge check).
 * "On their next turn" / "until..." is approximated as "until consumed," this project's usual
 * duration idiom.
 */
export const ANTAGONISTIC_SHIFT_DOWN_FLAG = 'pendingAntagonisticShiftDown';
export const ANTAGONISTIC_SNAG_FLAG = 'pendingAntagonisticSnag';

/**
 * Prompts for which of the 2 named effects to impose.
 * @returns {Promise<String|null>}   One of 'shiftDown'/'snag', or null if cancelled.
 */
export async function pickAntagonisticEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.AntagonisticPickEffectTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.AntagonisticPickEffectLabel')
    }</label><select name="effect">
      <option value="shiftDown">${game.i18n.localize('E20.AntagonisticShiftDown')}</option>
      <option value="snag">${game.i18n.localize('E20.AntagonisticSnag')}</option>
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
 * Applies the chosen Antagonistic effect - called once an Antagonistic attempt has succeeded.
 * @param {Actor} actor   The Troublemaker who succeeded.
 * @param {Actor} target   Who they targeted.
 * @param {String} effect   pickAntagonisticEffect's own return value.
 */
export async function applyAntagonisticEffect(actor, target, effect) {
  if (effect == 'shiftDown') {
    await bankPendingBonus(target, ANTAGONISTIC_SHIFT_DOWN_FLAG, { shiftDown: 1 });
  } else if (effect == 'snag') {
    await bankPendingBonus(target, ANTAGONISTIC_SNAG_FLAG, { beneficiaryId: actor.id });
  }
}

/**
 * Triggers the Intimidation-vs-Cleverness Skill Test itself, aimed at whichever one token the
 * player has targeted - same single-target "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape as Menace/Duty Of The Graphite.
 * @param {Actor} actor
 */
export async function activateAntagonistic(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.AntagonisticNoTarget'));
    return;
  }

  await actor._dice.rollSkill({
    skill: 'intimidation',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'cleverness',
    isAntagonistic: true,
  }, actor);
}
