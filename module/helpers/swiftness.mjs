/**
 * Swiftness (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "When you activate
 * this power, the nanomites within your body enable you to increase your Ground Movement by 20
 * feet for 1 scene. Alternatively, you gain 20 feet of Aerial Movement. If you do not end your
 * move on the ground, you fall."
 *
 * "Alternatively" reads as a choice made at activation time (not a permanent pick), so this is a
 * per-activation picker (same DialogV2 shape as pickMobileModeType) rather than a choiceType -
 * offering exactly the 2 movement types RAW names, unlike Mobile Mode's own full 4-type list. The
 * chosen type's own +20ft is a live override read in documents/actor.mjs#_prepareMovement,
 * alongside Boost of Speed/Warrior Rush's identical pattern - toggled off manually (no cost exists
 * to charge switching it on either, same untracked-daily-use gap as Protection/Augmented Combat).
 * "If you do not end your move on the ground, you fall" (the Aerial option's own risk) has nothing
 * to enforce - no fall-damage-on-forced-landing mechanism exists anywhere in this codebase - left
 * as a GM-adjudicated narrative caveat.
 */
const SWIFTNESS_FLAG = 'swiftnessMovementType';
const SWIFTNESS_BONUS_FEET = 20;

/**
 * @returns {Promise<String|null>}   'ground'/'aerial', or null if cancelled.
 */
export async function pickSwiftnessMovementType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SwiftnessPickTypeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SwiftnessPickTypeLabel')
    }</label><select name="movementType">
      <option value="ground">${game.i18n.localize('E20.SwiftnessGround')}</option>
      <option value="aerial">${game.i18n.localize('E20.SwiftnessAerial')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.movementType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

export function getSwiftnessMovementType(actor) {
  return actor.getFlag?.('essence20', SWIFTNESS_FLAG) ?? null;
}

/**
 * Toggles Swiftness on for the given movement type (off if it's already active for that same
 * type, matching the toggle idiom - re-picking the OTHER type while one is already active simply
 * switches which type is boosted).
 * @param {Actor} actor
 * @param {String} movementType
 * @returns {Promise<Boolean>}   The new state (true = now active).
 */
export async function toggleSwiftness(actor, movementType) {
  const nowActive = getSwiftnessMovementType(actor) != movementType;
  await actor.setFlag('essence20', SWIFTNESS_FLAG, nowActive ? movementType : null);
  return nowActive;
}

export function getSwiftnessBonusFeet(actor, movementType) {
  return getSwiftnessMovementType(actor) == movementType ? SWIFTNESS_BONUS_FEET : 0;
}
