/**
 * Deadstick (Quartermaster's Guide to Gear, Neutralizer Focus, Technician, 10th level, p.26):
 * "You stop enemy automatons in their tracks. As a Standard action, you can target a robot within
 * 100ft with a Technology Skill Test against its Willpower or Cleverness. On a success, the
 * robot gains the Stunned condition for 1 round."
 *
 * "A robot" is dropped as an unenforceable narrative qualifier (this system has no "is this NPC a
 * robot" classification anywhere - the same gap already confirmed blocking Electromagnetic's own
 * "-3 vs non-robots" clause) - the player self-polices the fictional target, the same idiom this
 * project already applies to every other similarly narrow narrative qualifier. "100ft" range
 * isn't enforced either, matching every other range-unchecked single-target Perk in this project.
 *
 * The Willpower-or-Cleverness choice is a real pick between two named Defenses (not a flavor
 * qualifier), so it gets its own small picker - the same single-dropdown DialogV2 shape
 * pickHobbleCondition/pickDefenseType already establish - rather than defaulting to one
 * representative Defense the way Duty Of The Graphite's own "a Social Skill Test" default does
 * (there, RAW itself only ever names a Skill category, not a real fixed Defense pair).
 */
export async function pickDeadstickDefenseType() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.DeadstickPickTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.DeadstickPickLabel')
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
 * Triggers the actual Technology-vs-Willpower-or-Cleverness Skill Test against whichever token is
 * currently targeted.
 * @param {Actor} actor
 */
export async function activateDeadstick(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.DeadstickNoTarget'));
    return;
  }

  const defenseType = await pickDeadstickDefenseType();
  if (!defenseType) {
    return;
  }

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType,
    isDeadstick: true,
  }, actor);
}
