import { E20 } from "./config.mjs";

export const PRIMAL_MOVEMENT_ID = "Compendium.essence20.technorganic_secrets.Item.y4dfWDqQQt6V5Sk6";

/**
 * Primal Movement (Technorganic Secrets, General Perk, p.48): "Choose a Movement type you do not
 * have access to in your Bot Mode. You gain a Movement of that type of 20 feet."
 *
 * The opposite filter from perk-handler.mjs's own generic choiceType:'movement' case (which
 * offers only a movement type the actor ALREADY possesses, e.g. Fast/PR CRB's own copy of it) -
 * this Perk grants a brand new one instead, so it's handled as its own one-off pick rather than
 * reusing that generic case. "Bot Mode" is read off the actor's own base movement (this Perk is
 * TF-only, and system.movement is the Bot Mode figure - system.altModeMovement is the separate
 * Alt Mode one, per documents/actor.mjs's own Convert handling), same field Fast/Movement
 * Booster's own picker already reads.
 */

/**
 * Prompts for a Movement type the actor doesn't already have, then grants it 20ft.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The movement type granted, or null if the actor already has
 *   every type or the picker was cancelled.
 */
export async function grantPrimalMovement(actor) {
  const choices = {};
  for (const type of Object.keys(E20.movementTypes)) {
    if (!(actor.system.movement?.[type]?.base > 0)) {
      choices[type] = game.i18n.localize(E20.movementTypes[type]);
    }
  }

  if (!Object.keys(choices).length) {
    ui.notifications.warn(game.i18n.localize('E20.PrimalMovementNoNewType'));
    return null;
  }

  const options = Object.entries(choices)
    .map(([key, label]) => `<option value="${key}">${foundry.utils.escapeHTML(label)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PrimalMovementTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.PrimalMovementPickType')
    }</label><select name="type">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.type.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel') {
    return null;
  }

  await actor.update({
    [`system.movement.${chosen}.bonus`]: (actor.system.movement[chosen]?.bonus ?? 0) + 20,
  });

  return chosen;
}
