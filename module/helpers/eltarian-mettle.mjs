import { E20 } from "./config.mjs";

/**
 * Eltarian Mettle (Through the Shattered Grid, Guardian of Eltar, 7th level, p.72): "As a Free
 * action, spend 1 Personal Power to remove one Condition (other than Defeated) from yourself."
 *
 * Unlike Purple Ranger Prime's own fixed 3-Condition sweep or Comic Flair's fixed
 * Frightened/Impaired pair, RAW lets the player remove ANY currently-active Condition - so the
 * picker's own option list is built dynamically from whichever statuses the actor actually has
 * right now (excluding Defeated, RAW's own named exception), rather than a fixed list like
 * helpers/banked-buffs.mjs#pickHobbleCondition/pickElementalStormCondition.
 */

/**
 * Prompts for which of the actor's own currently-active Conditions (excluding Defeated) to
 * remove.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The chosen Condition key, or null if there's nothing to
 *   remove or the picker was cancelled.
 */
export async function pickEltarianMettleCondition(actor) {
  const activeConditions = E20.statusEffects
    .filter(status => status.id != 'defeated' && actor.statuses?.has(status.id));
  if (!activeConditions.length) {
    return null;
  }

  const options = activeConditions
    .map(status => `<option value="${status.id}">${game.i18n.localize(status.name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EltarianMettlePickConditionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EltarianMettlePickConditionLabel')
    }</label><select name="condition">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.condition.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for and removes one of the actor's own active Conditions.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The Condition actually removed, or null if there was nothing
 *   to remove or the picker was cancelled.
 */
export async function applyEltarianMettle(actor) {
  const condition = await pickEltarianMettleCondition(actor);
  if (!condition) {
    return null;
  }

  await actor.toggleStatusEffect(condition, { active: false });
  return condition;
}
