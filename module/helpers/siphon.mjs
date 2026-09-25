/**
 * Siphon (Transformers CRB, Focus: Technologist, 17th level, p.83): "At 17th level, as a Standard
 * action, make a Technology Skill Test against the Toughness or Evasion of an adjacent
 * Cybertronian. On a success, you deal 1 Damage and gain 1 Energon Point."
 *
 * Same single-target "trigger a real dialog roll via actor._dice.rollSkill()" shape as Deadstick
 * (helpers/deadstick.mjs's own doc comment) for the Toughness-or-Evasion picker, "adjacent" left
 * unenforced (same range-unchecked idiom every other single-target Perk in this project already
 * accepts). The Energon gain isn't capped at system.energon.normal.max - matching this codebase's
 * own established precedent for an Energon grant (Energon Cube/Energon Snack, helpers/banked-
 * buffs.mjs).
 */
export const SIPHON_ID = "Compendium.essence20.tf_crb.Item.Fc9DBgnZffr8VKDU";
const SIPHON_DAMAGE = 1;
const SIPHON_ENERGON_GAIN = 1;

/**
 * Prompts for which Defense (Toughness or Evasion) this Siphon attempt targets.
 * @returns {Promise<String|null>}
 */
export async function pickSiphonDefenseType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.SiphonPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.SiphonPickLabel')
    }</label><select name="defenseType">
      <option value="toughness">${game.i18n.localize('E20.DefenseToughness')}</option>
      <option value="evasion">${game.i18n.localize('E20.DefenseEvasion')}</option>
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
 * Triggers the actual Technology-vs-Toughness-or-Evasion Skill Test against whichever token is
 * currently targeted.
 * @param {Actor} actor
 */
export async function activateSiphon(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.SiphonNoTarget'));
    return;
  }

  const defenseType = await pickSiphonDefenseType();
  if (!defenseType) {
    return;
  }

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType,
    isSiphon: true,
  }, actor);
}

/**
 * Deals 1 Damage to the target (floored at 0) and grants 1 Energon Point to the actor, on a
 * successful Siphon attempt.
 * @param {Actor} targetActor
 * @param {Actor} actor
 */
export async function applySiphonEffect(targetActor, actor) {
  await targetActor.update({
    'system.health.value': Math.max(0, targetActor.system.health.value - SIPHON_DAMAGE),
  });

  await actor.update({
    'system.energon.normal.value': (actor.system.energon?.normal?.value ?? 0) + SIPHON_ENERGON_GAIN,
  });
}
