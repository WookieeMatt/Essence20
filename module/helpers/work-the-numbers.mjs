/**
 * Work the Numbers (Transformers CRB, Scout base, Cybertronian Perk, p.58): "At the beginning of
 * every round of combat after the first, you can spend an Energon Point to move a creature in the
 * combat up or down one place in the Initiative order."
 *
 * Reuses the same Combatant#initiative-nudge idiom Right Behind You/Boost Initiative already
 * establish (helpers/right-behind-you.mjs, helpers/boost-initiative.mjs) - picks the currently-
 * targeted combatant (same auto-detect-via-targeted-token idiom those Perks use, since RAW names
 * no other way to choose which "creature in the combat" is moved) and moves them past whichever
 * neighbor is immediately above/below them in game.combat.turns (Foundry's own pre-sorted
 * Initiative order), via a small up/down picker. "The beginning of every round of combat after the
 * first" is approximated as "any round but the first" (round == 1 blocks it), the same simplified
 * "no per-phase-of-the-round timing enforcement" idiom this project already applies to similar
 * once-per-round-start clauses (e.g. Sirens Blaring's own "Resetting Your Initiative" trigger).
 */
export const PENDING_WORK_THE_NUMBERS_ENERGON_FLAG = 'workTheNumbersEnergonSpent';

/**
 * @returns {Promise<String|null>}   'up' or 'down', or null if cancelled.
 */
async function pickWorkTheNumbersDirection() {
  const options = [
    ['up', game.i18n.localize('E20.WorkTheNumbersUpOption')],
    ['down', game.i18n.localize('E20.WorkTheNumbersDownOption')],
  ].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.WorkTheNumbersPickDirectionTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.WorkTheNumbersPickDirectionLabel')
    }</label><select name="direction">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.direction.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * @returns {Boolean}
 */
export function canUseWorkTheNumbers() {
  return !!game.combat && game.combat.round > 1;
}

/**
 * Moves the currently-targeted combatant up or down one place in game.combat.turns, nudging their
 * initiative just past whichever neighbor is in that direction. No-ops (returns false) if there's
 * no valid target, or the target is already at that end of the order.
 * @param {Actor} actor   Unused beyond validating there IS an actor - RAW doesn't require the
 *   granter themselves to be in the combat at all, but every call site already gates on it having
 *   one.
 * @returns {Promise<Boolean>}
 */
export async function activateWorkTheNumbers() {
  if (!canUseWorkTheNumbers()) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor;
  const combatant = targetActor && game.combat.combatants.find(c => c.actor?.id == targetActor.id);
  if (!combatant) {
    return false;
  }

  const direction = await pickWorkTheNumbersDirection();
  if (!direction) {
    return false;
  }

  const turns = game.combat.turns;
  const index = turns.findIndex(c => c.id == combatant.id);
  const neighborIndex = direction == 'up' ? index - 1 : index + 1;
  const neighbor = turns[neighborIndex];
  if (index < 0 || !neighbor || neighbor.initiative == null) {
    return false;
  }

  const NUDGE = 0.01;
  const newInitiative = direction == 'up' ? neighbor.initiative + NUDGE : neighbor.initiative - NUDGE;
  await combatant.update({ initiative: newInitiative });
  return true;
}
