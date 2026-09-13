import { E20 } from "./config.mjs";

/**
 * Extra Rough Training (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 3rd level,
 * p.10): "Outside of combat, you can have each of your teammates attempt a DIF 15 Skill Test. On
 * a success, they secure confidence in their skills and gain an Edge the next time they test that
 * skill. On a failure, though, they still learn something from your training and gain ↑1 the next
 * time they test that skill. You decide which skill they're training, and you can choose a
 * different skill for each teammate. Each teammate can only attempt one Extra Rough Training
 * Skill Test per mission."
 *
 * Dispatched as a "Use" button on the OFFICER's own Extra Rough Training item, targeting whichever
 * ally token is currently selected (the same auto-detect idiom Mark Target/Splinter Defense
 * already establish) - the Officer picks the skill via a dialog (same single-dropdown shape
 * Ageless Knowledge's own picker uses), then the ALLY makes the actual DIF 15 Skill Test
 * themselves via actor._dice.rollSkill() (the same "trigger a real dialog roll" shape Absolute
 * Menace/Duty Of The Graphite already establish, just on a THIRD actor's own roll rather than the
 * button-clicker's).
 *
 * "Once per mission" can't reuse hasUsedThisEncounter/markUsedThisEncounter (helpers/perks.mjs) -
 * this Perk is explicitly used OUTSIDE combat, and both of those are unconditional no-ops without
 * an active game.combat, unlike every other "once per mission -> once per encounter" Perk in this
 * project (all triggered mid-combat, where that approximation actually holds). Tracked instead as
 * a plain, combat-independent flag on the ALLY (whose own attempt is being spent, not the
 * Officer's), with no active reset anywhere - this codebase has no mission/session-boundary hook
 * to clear it against - the same "GM manages the edges" idiom this project already accepts for
 * other unenforceable durations.
 *
 * The Edge/↑1 reward is banked scoped to the chosen skill (the same shape Ageless Knowledge's own
 * pendingAgelessKnowledge already establishes for a skill-scoped bank), consumed on the ally's own
 * next roll of that exact skill - see dice.mjs's own consumption for both directions.
 */
export const EXTRA_ROUGH_TRAINING_FLAG = 'pendingExtraRoughTraining';
const USED_FLAG = 'extraRoughTrainingUsedThisMission';

/**
 * Prompts for which Skill the ally should train - same single-dropdown DialogV2 shape as
 * pickAgelessKnowledgeSkill/pickHobbleCondition.
 * @returns {Promise<String|null>}
 */
export async function pickExtraRoughTrainingSkill() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExtraRoughTrainingPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExtraRoughTrainingPickSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.skill.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Whether the given ally can still attempt an Extra Rough Training Skill Test this mission.
 * @param {Actor} allyActor
 * @returns {Boolean}
 */
export function canTrainAlly(allyActor) {
  return !allyActor?.getFlag?.('essence20', USED_FLAG);
}

/**
 * Resolves the currently-targeted ally, prompts for the skill, and triggers their own DIF 15
 * Skill Test.
 * @param {Actor} officer
 * @returns {Promise<Boolean|null>}   False if the picker was cancelled, null if there's no valid
 *   ally to target (surfaced as a warning by the caller) or they've already used their attempt
 *   this mission, true once the roll is triggered.
 */
export async function activateExtraRoughTraining(officer) {
  const allyActor = game.user.targets.first()?.actor;
  if (!allyActor || !canTrainAlly(allyActor)) {
    return null;
  }

  const skill = await pickExtraRoughTrainingSkill();
  if (!skill) {
    return false;
  }

  await allyActor._dice.rollSkill({
    skill, essence: E20.skillToEssence[skill], shiftUp: 0, shiftDown: 0, dif: '15',
    isExtraRoughTrainingAttempt: true, extraRoughTrainingSkill: skill,
  }, allyActor);
  await allyActor.setFlag('essence20', USED_FLAG, true);
  return true;
}
