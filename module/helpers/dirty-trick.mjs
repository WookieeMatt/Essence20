import { E20 } from "./config.mjs";

/**
 * Dirty Trick (GI Joe CRB, Ranger Environmental Exposure choice, p.91): "In your environment of
 * expertise, as an Attack, make a Survival Skill Test against your target's Willpower. On a
 * success, you can choose to Blind or Stun your target for 1 turn or knock them prone."
 *
 * "In your environment of expertise" is dropped as unenforceable - this codebase has no "what
 * environment am I currently in" state to check (the same gap already blocking every other
 * Environmental Exposure choice), the same "player self-polices the fictional precondition" idiom
 * this project already applies broadly. The roll itself is a genuine single-target Skill-Test-vs-
 * Defense with a post-hit Condition choice - same "trigger a real dialog roll via
 * actor._dice.rollSkill()" shape Duty Of The Graphite/Absolute Menace already establish, aimed at
 * whichever ONE enemy the player has targeted, with the actual Condition picked afterward via a
 * new picker (pickDirtyTrickCondition) - the same "ask fresh each successful hit" shape Hobble's
 * own condition picker already establishes, just with a different 3-option set (Blind/Stun/Prone
 * rather than Immobilized/Prone/Restrained).
 */
export async function activateDirtyTrick(actor) {
  await actor._dice.rollSkill({
    skill: 'survival', essence: 'smarts', shiftUp: 0, shiftDown: 0, defenseType: 'willpower', isDirtyTrick: true,
  }, actor);
}

/**
 * Prompts for which Condition Dirty Trick should inflict on a successfully-hit target - "your
 * choice" of Blind, Stun, or Prone. Same DialogV2 shape as pickHobbleCondition.
 * @returns {Promise<String|null>}   One of 'blinded'/'stunned'/'prone', or null if cancelled.
 */
export async function pickDirtyTrickCondition() {
  const options = ['blinded', 'stunned', 'prone']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.statusEffects.find(s => s.id == key).name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.DirtyTrickPickConditionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.DirtyTrickPickConditionLabel')
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
