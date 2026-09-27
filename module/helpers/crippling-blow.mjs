import { E20 } from "./config.mjs";

/**
 * Crippling Blow (Decepticon Directive, Raider Focus, p.59 - pack lists p.57): "if you make a
 * melee attack at ↓1, you can also inflict the Blinded, Deafened, or Prone condition on the
 * target in addition to dealing damage."
 *
 * Same overall shape as Hobble (Decepticon Directive Raider, 20th level, p.63) - a declared-
 * downshift checkbox paid before the roll, with the Condition-on-hit choice resolved afterward via
 * a fresh picker once the attack actually lands (pickCripplingBlowCondition, the same "ask fresh
 * each successful hit" idiom pickHobbleCondition/pickDirtyTrickCondition already establish) - just
 * a real melee weapon Attack rather than Hobble's ranged one, ↓1 instead of ↓2, and its own
 * 3-option set (Blinded/Deafened/Prone rather than Hobble's own).
 */
export const CRIPPLING_BLOW_ID = "Compendium.essence20.decepticon_directive.Item.SKHtIija5VRPcuBu";

/**
 * Prompts for which Condition Crippling Blow should inflict on a successfully-hit target - "your
 * choice" of Blinded, Deafened, or Prone. Same DialogV2 shape as pickHobbleCondition/
 * pickDirtyTrickCondition.
 * @returns {Promise<String|null>}   One of 'blinded'/'deafened'/'prone', or null if cancelled.
 */
export async function pickCripplingBlowCondition() {
  const options = ['blinded', 'deafened', 'prone']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.statusEffects.find(s => s.id == key).name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.CripplingBlowPickConditionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.CripplingBlowPickConditionLabel')
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
