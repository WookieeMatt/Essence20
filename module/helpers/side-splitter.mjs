import { applyDamage } from "./combat.mjs";

/**
 * Side Splitter (MLP CRB, Spirit of Laughter Influence Perk, p.86): "As a standard action, you can
 * make a Performance check against a target's Willpower or Cleverness. On a success, you deal
 * 1 damage."
 *
 * Same "skill picked up front, a real Skill-Test-vs-Defense roll triggered via
 * actor._dice.rollSkill(), a post-hit flat-damage application" shape helpers/words-can-hurt.mjs
 * already establishes, simplified since Performance and the 1-damage payoff are both fixed - only
 * which Defense (Willpower or Cleverness) is a choice.
 */
export const SIDE_SPLITTER_ID = "Compendium.essence20.mlp_crb.Item.o6h9U6oeWfpXYOA4";

/**
 * @returns {Promise<String|null>}   'willpower' or 'cleverness', or null if cancelled.
 */
export async function pickSideSplitterDefense() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SideSplitterPickDefenseTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SideSplitterPickDefenseLabel')
    }</label><select name="defenseType">
      <option value="willpower">${game.i18n.localize('E20.DefenseWillpower')}</option>
      <option value="cleverness">${game.i18n.localize('E20.DefenseCleverness')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.defenseType.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Resolves the currently-targeted actor, prompts for which Defense, and triggers the roll.
 * @param {Actor} actor
 * @returns {Promise<Actor|null|false>}
 */
export async function activateSideSplitter(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.SideSplitterNoTarget'));
    return null;
  }

  const defenseType = await pickSideSplitterDefense();
  if (!defenseType) {
    return false;
  }

  await actor._dice.rollSkill({
    skill: 'performance', essence: 'social', shiftUp: 0, shiftDown: 0, defenseType,
    isSideSplitterAttempt: true, sideSplitterTargetUuid: targetActor.uuid,
  }, actor);
  return targetActor;
}

/**
 * Applies the flat 1 damage on a successful hit - called from dice.mjs's own post-roll success
 * handling. RAW names no damage type ("you deal 1 damage") - 'blunt' is used as this codebase's
 * own generic physical default (e.g. Unarmed Combat's base profile), since 'stun' would reduce
 * the Stun track instead of actually applying damage.
 * @param {Actor} targetActor
 */
export async function applySideSplitterDamage(targetActor) {
  await applyDamage(targetActor, 1, 'blunt');
}
