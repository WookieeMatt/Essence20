import { E20 } from "./config.mjs";

/**
 * Mobile Mode (Through the Shattered Grid, Grid Power, p.26): "When you choose this Grid Power,
 * select a Movement type, such as aerial, aquatic, underground, or other. While Morphed, you can
 * spend 1 Personal Power to gain that type of Movement at 30 feet until the end of the scene."
 *
 * RAW's own "select a Movement type" reads as a one-time pick at Power-selection time, which would
 * need a genuinely new choiceType wired through sheet-handlers/perk-handler.mjs's own
 * setPerkValues/buildChoices/teardown trio (the same scope of work `elementDamageType`/
 * `wisdomOfTheElders` needed) - disproportionate for one Power. Approximated instead as a picker
 * shown at EACH activation (same DialogV2 shape as pickHobbleCondition/pickDefenseType) - the
 * player picks the same type every time in practice, so this is functionally equivalent to a
 * permanent choice without the extra schema machinery. This system's own 4 movement types
 * (E20.movementTypes: aerial/climb/ground/swim) stand in for RAW's own "aerial, aquatic,
 * underground, or other" list (climb/swim approximating underground/aquatic).
 *
 * The granted movement is a live, non-consumed override read directly in
 * documents/actor.mjs#_prepareMovement (same shape as Wisdom of the Elders' own Lightfoil Wings),
 * not touching _prepareHealth/_prepareDefenses.
 */
const MOBILE_MODE_FLAG = 'mobileModeType';

/**
 * @returns {Promise<String|null>}   One of E20.movementTypes' own keys, or null if cancelled.
 */
export async function pickMobileModeType() {
  const options = Object.keys(E20.movementTypes)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.movementTypes[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MobileModePickTypeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MobileModePickTypeLabel')
    }</label><select name="movementType">${options}</select></div>`,
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

export function getMobileModeType(actor) {
  return actor.getFlag?.('essence20', MOBILE_MODE_FLAG) ?? null;
}

/**
 * @param {Actor} actor
 * @param {String} movementType
 */
export async function activateMobileMode(actor, movementType) {
  await actor.setFlag('essence20', MOBILE_MODE_FLAG, movementType);
}
