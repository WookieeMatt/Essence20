/**
 * Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61): "As a Standard action, you
 * can gain an Aerial, Climbing, or Swimming Movement equal to your Ground Movement until the end
 * of your turn." ("In your environment of expertise" is dropped, the same narrow-qualifier idiom
 * this project already applies elsewhere - Iconoclast/Indoctrinated/etc.)
 *
 * A toggle (spend nothing this codebase tracks, since Standard actions aren't budgeted) picking
 * which of the 3 movement types to grant - checked in Essence20Actor#_prepareMovement, the same
 * permitted movement-math touch-point Warrior Rush/Wisdom of the Elders' Lightfoil Wings already
 * use. "Until the end of your turn" is approximated as "until switched back off manually," this
 * project's usual duration idiom for a self-managed toggle.
 */

const ANIMAL_GAIT_FLAG = 'animalGaitMovementType';

/**
 * The movement type Animal Gait is currently granting, or null if inactive.
 * @param {Actor} actor
 * @returns {String|null}
 */
export function getAnimalGaitType(actor) {
  return actor.getFlag?.('essence20', ANIMAL_GAIT_FLAG) ?? null;
}

/**
 * Prompts for which movement type to gain.
 * @returns {Promise<String|null>}
 */
export async function pickAnimalGaitType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.AnimalGaitPickTypeTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.AnimalGaitPickTypeLabel')
    }</label><select name="movementType">
      <option value="aerial">${game.i18n.localize('E20.MovementTypeAerial')}</option>
      <option value="climb">${game.i18n.localize('E20.MovementTypeClimb')}</option>
      <option value="swim">${game.i18n.localize('E20.MovementTypeSwim')}</option>
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

/**
 * Toggles Animal Gait - switching ON prompts for a movement type; switching OFF clears it.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new active state, or null if the picker was cancelled.
 */
export async function toggleAnimalGait(actor) {
  if (getAnimalGaitType(actor)) {
    await actor.unsetFlag('essence20', ANIMAL_GAIT_FLAG);
    return false;
  }

  const movementType = await pickAnimalGaitType();
  if (!movementType) {
    return null;
  }

  await actor.setFlag('essence20', ANIMAL_GAIT_FLAG, movementType);
  return true;
}
