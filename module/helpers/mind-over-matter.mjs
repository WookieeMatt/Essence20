import { E20 } from "./config.mjs";

/**
 * Mind Over Matter (GI Joe CRB, Focus: Battlefield Psychologist, 6th level, p.86): "At 6th level,
 * you can convince allies to shrug off injuries. You can use Intimidation or Persuasion in place
 * of Science to heal allies. If you have ranks in Science (Medicine), you can re-allocate these
 * ranks to other Smarts skills when you gain this benefit."
 *
 * The base "restore Health via a Skill Test" mechanic (Core Rules Combat chapter, p.209-210,
 * DIF = 5 + 5 per Health) was built for I've Got You (see helpers/i-ve-got-you.mjs's own doc
 * comment) - Mind Over Matter is the natural follow-on flagged there, substituting the ROLLED
 * skill (player's choice of Intimidation or Persuasion, folded into the same amount-picker
 * dialog) rather than always using Science. Unlike I've Got You's own +1 bonus, Mind Over Matter
 * grants no extra Health - just the skill substitution - but still clears Defeated on a
 * successful heal (per the Core Rules Conditions section: "Conditions last until removed (such
 * as by healing when Defeated)" - a general rule, not specific to any one Perk). The chargen-time
 * "re-allocate Science (Medicine) ranks" clause is a one-off bookkeeping choice, not a roll-time
 * mechanic - left unautomated, the same idiom Safety First's own chargen-only clause already
 * established elsewhere in this Focus.
 */
export const MIND_OVER_MATTER_ID = "Compendium.essence20.gi_joe_crb.Item.eLO9NJ7akWmoPHEK";
const MAX_AMOUNT = 6;

/**
 * Prompts for which skill to use (Intimidation or Persuasion) and how much Health to attempt to
 * restore.
 * @returns {Promise<{skill: String, amount: Number}|null>}   Null if cancelled/invalid.
 */
async function pickMindOverMatterDetails() {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MindOverMatterPickTitle') },
    classes: ["window-app"],
    content: `
      <div class="form-group"><label>${game.i18n.localize('E20.MindOverMatterSkillLabel')}</label>
        <select name="skill">
          <option value="intimidation">${game.i18n.localize('E20.SkillIntimidation')}</option>
          <option value="persuasion">${game.i18n.localize('E20.SkillPersuasion')}</option>
        </select></div>
      <div class="form-group"><label>${game.i18n.localize('E20.IveGotYouPickAmountLabel')}</label>
        <input type="number" name="amount" min="1" max="${MAX_AMOUNT}" value="1" /></div>
    `,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          skill: button.form.elements.skill.value,
          amount: parseInt(button.form.elements.amount.value),
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!result || result == 'cancel' || !Number.isInteger(result.amount) || result.amount <= 0) {
    return null;
  }

  return { skill: result.skill, amount: Math.min(result.amount, MAX_AMOUNT) };
}

/**
 * Prompts for a skill and Health amount, then triggers a real Skill Test against RAW's own DIF
 * formula, targeting whichever ally is currently targeted.
 * @param {Actor} actor
 */
export async function activateMindOverMatter(actor) {
  if (!game.user.targets.first()) {
    ui.notifications.warn(game.i18n.localize('E20.IveGotYouNoTarget'));
    return;
  }

  const details = await pickMindOverMatterDetails();
  if (!details) {
    return;
  }

  const dif = 5 + (5 * details.amount);
  await actor._dice.rollSkill({
    skill: details.skill, essence: E20.skillToEssence[details.skill], dif: String(dif),
    isMindOverMatter: true, mindOverMatterAmount: details.amount,
  }, actor);
}

/**
 * Applies the healing on a successful cast - no bonus beyond the chosen amount, but still clears
 * Defeated if the target was Defeated (see this file's own doc comment).
 * @param {Actor} healTarget
 * @param {Number} amount
 */
export async function applyMindOverMatterHeal(healTarget, amount) {
  const wasDefeated = !!healTarget.statuses?.has?.('defeated');

  await healTarget.update({
    'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + amount),
  });

  if (wasDefeated) {
    await healTarget.toggleStatusEffect('defeated', { active: false });
  }
}
