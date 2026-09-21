import { E20 } from "./config.mjs";

/**
 * Natural Movement (GI Joe CRB, Focus: Predator, 6th level, p.93): "when in your environment of
 * expertise, you use your surroundings as deftly as the animals native to the environment. As a
 * Standard action, you gain a Climb or Swim Movement equal to half your Ground Movement until the
 * end of your next turn."
 *
 * "In your environment of expertise" is the same unenforceable narrative precondition
 * `helpers/sneak-attack.mjs#checkPredatorSneakAttackEligibility`'s own doc comment already
 * documents this system has no hook to check automatically - dropped here too, but unlike
 * Environmental Armor/Prowl (passive, always-on effects with NOTHING else gating them, correctly
 * left as infra) this Perk is already an explicit player-declared Standard action - clicking the
 * "Use" button itself IS the player's own declaration that the fictional trigger applies, the
 * same "player self-polices" idiom this project already accepts for narrower narrative qualifiers.
 *
 * A plain on/off toggle (same shape as Dig In/Bulwark), letting the player choose Climb or Swim
 * up front via a picker. "Until the end of your next turn" isn't actively expired (no such hook
 * exists) - a manual toggle-off, same duration-approximation idiom as Dig In's own "until you
 * move."
 */
const NATURAL_MOVEMENT_FLAG = 'naturalMovementType';

/**
 * Prompts for Climb or Swim.
 * @returns {Promise<String|null>}   'climb'/'swim', or null if cancelled.
 */
export async function pickNaturalMovementType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.NaturalMovementPickTypeTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.NaturalMovementPickTypeLabel')}</p>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize(E20.movementTypes.climb), action: 'climb' },
      { label: game.i18n.localize(E20.movementTypes.swim), action: 'swim' },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Which movement type Natural Movement is currently boosting, if any.
 * @param {Actor} actor
 * @returns {String|null}   'climb'/'swim', or null if inactive.
 */
export function getNaturalMovementType(actor) {
  return actor.getFlag?.('essence20', NATURAL_MOVEMENT_FLAG) ?? null;
}

/**
 * Toggles Natural Movement off if active, or prompts for Climb/Swim and toggles it on.
 * @param {Actor} actor
 * @returns {Promise<String|false|null>}   The newly-active type ('climb'/'swim') if just switched
 *   on; `false` if it was just switched off; `null` if the picker was cancelled (no change made).
 */
export async function toggleNaturalMovement(actor) {
  if (getNaturalMovementType(actor)) {
    await actor.unsetFlag('essence20', NATURAL_MOVEMENT_FLAG);
    return false;
  }

  const type = await pickNaturalMovementType();
  if (!type) {
    return null;
  }

  await actor.setFlag('essence20', NATURAL_MOVEMENT_FLAG, type);
  return type;
}
