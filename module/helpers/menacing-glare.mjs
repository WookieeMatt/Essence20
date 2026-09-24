import { bankPendingBonus } from "./perks.mjs";

/**
 * Menacing Glare (Beneath the Helmet, Dark Ranger, 2nd level, p.39): "As a Standard action, spend
 * 1 Personal Power to make an Intimidation Skill Test against a target's Willpower. Upon success,
 * you can impose ONE of the following effects on the target until the end of your next turn:
 * - The target suffers Snag on the next Skill Test they perform.
 * - You have Edge on the next Skill Test you make against the target.
 * - The target is Frightened of you."
 *
 * The roll itself (an Intimidation Skill Test vs. a manually-chosen Willpower Defense) is already
 * fully generic - nothing new needed there. What this file adds: the post-success 3-way choice
 * (pickMenacingGlareEffect, a DialogV2 picker same shape as pickHobbleCondition) and applying
 * whichever one was picked (applyMenacingGlareEffect):
 * - Snag is banked on the TARGET (pendingMenacingGlareSnag), consumed on their own next roll of
 *   any kind - same unscoped-Snag shape as Through the Arches/Debilitating Strike.
 * - Edge is banked on the ACTOR (pendingMenacingGlareEdge), scoped to this specific target (by
 *   id) - the first "self-Edge that only applies against one specific other actor" flag in this
 *   codebase, consumed in dice.mjs#_getAutomaticCombatModifiers's per-target block.
 * - Frightened is applied immediately via the same Actor#toggleStatusEffect('frightened', ...)
 *   call Trigger Happy already uses.
 * "Until the end of your next turn" is approximated as "until consumed," this project's usual
 * duration idiom for a "your next X" clause.
 */
export const MENACING_GLARE_SNAG_FLAG = 'pendingMenacingGlareSnag';
export const MENACING_GLARE_EDGE_FLAG = 'pendingMenacingGlareEdge';

/**
 * Prompts for which of the 3 named effects to impose - same single-select DialogV2 shape as
 * pickHobbleCondition/pickDefenseType.
 * @returns {Promise<String|null>}   One of 'snag'/'edge'/'frightened', or null if cancelled.
 */
export async function pickMenacingGlareEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MenacingGlarePickEffectTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MenacingGlarePickEffectLabel')
    }</label><select name="effect">
      <option value="snag">${game.i18n.localize('E20.MenacingGlareSnag')}</option>
      <option value="edge">${game.i18n.localize('E20.MenacingGlareEdge')}</option>
      <option value="frightened">${game.i18n.localize('E20.MenacingGlareFrightened')}</option>
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
 * Applies the chosen Menacing Glare effect - called once a Menacing Glare attempt has actually
 * succeeded.
 * @param {Actor} actor   The Dark Ranger who succeeded.
 * @param {Actor} target   Who they targeted.
 * @param {String} effect   pickMenacingGlareEffect's own return value.
 */
export async function applyMenacingGlareEffect(actor, target, effect) {
  if (effect == 'snag') {
    await bankPendingBonus(target, MENACING_GLARE_SNAG_FLAG, { snag: true });
  } else if (effect == 'edge') {
    await bankPendingBonus(actor, MENACING_GLARE_EDGE_FLAG, { targetId: target.id });
  } else if (effect == 'frightened') {
    await target.toggleStatusEffect('frightened', { active: true });
  }
}
