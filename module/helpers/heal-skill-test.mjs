/**
 * Roll-a-Skill-Test-then-heal/Repair-by-the-chosen-amount primitive (Core Rules Combat chapter,
 * p.209-210): "as a Standard action, Science Skill Tests can restore Health to living creatures,
 * and Technology Skill Tests can restore Health to machines (including Cybertronians)... The DIF
 * of a Skill Test to restore Health is equal to 5 + 5 per Health you want to restore."
 *
 * This base mechanic already exists three times over, copy-pasted per-Perk with no shared code
 * (helpers/i-ve-got-you.mjs, helpers/regeneration.mjs, helpers/mind-over-matter.mjs each have their
 * own near-identical pickHealAmount/DIF-formula/rollSkill dispatch). This module is the reusable
 * version, built for the next wave of Perks waiting on it (Patch Up, Preventative Measures, Tough
 * It Out - all Transformers CRB) rather than adding a fourth bespoke copy. The existing three are
 * left as-is (not part of this pass, and already have their own tests) rather than risk a
 * refactor of working code.
 *
 * Stand Together (Transformers CRB, Field Commander, 18th level, p.65) is a different shape - a
 * flat DIF 15 whose DEGREE OF SUCCESS multiplies a fixed heal amount across every ally at once, not
 * a player-chosen amount driving the DIF - so it has its own small dispatch (helpers/stand-
 * together.mjs) rather than using this module's amount-picker/DIF formula, only sharing
 * applyHealSkillTestResult's actual Health/Temp-Health application below.
 */
const MAX_HEAL_SKILL_TEST_AMOUNT = 6;

/**
 * RAW's own DIF formula for a Skill Test to restore Health - see this file's own doc comment.
 * @param {Number} amount   How much Health the roller is attempting to restore.
 * @returns {Number}
 */
export function computeRestoreHealthDif(amount) {
  return 5 + (5 * amount);
}

/**
 * Prompts for how much Health to attempt to restore (1 up to a generous bound - RAW's own DIF
 * formula makes anything higher increasingly implausible to succeed at anyway). Same shape/wording
 * as I've Got You's own picker (helpers/i-ve-got-you.mjs) - reusing its lang keys rather than
 * adding near-duplicate ones, since the prompt itself ("Health to attempt to restore") is generic.
 * @param {Number} maxAmount
 * @returns {Promise<Number|null>}   The chosen amount, or null if cancelled/invalid.
 */
export async function pickHealSkillTestAmount(maxAmount = MAX_HEAL_SKILL_TEST_AMOUNT) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.IveGotYouPickAmountTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.IveGotYouPickAmountLabel')
    }</label><input type="number" name="amount" min="1" max="${maxAmount}" value="1" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => parseInt(button.form.elements.amount.value),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return Number.isInteger(chosen) && chosen > 0 ? Math.min(chosen, maxAmount) : null;
}

/**
 * Applies the healing on a successful cast - real Health by default, or Temp Health for a Perk
 * like Preventative Measures that converts the roll's own result into Temp Health instead. Clears
 * Defeated on a real-Health heal, matching the Core Rules' own general rule ("Conditions last
 * until removed, such as by healing when Defeated") already established by I've Got You/
 * Regeneration/Mind Over Matter above.
 * @param {Actor} targetActor
 * @param {Number} amount
 * @param {Object} [options]
 * @param {Boolean} [options.isTempHealth]
 */
export async function applyHealSkillTestResult(targetActor, amount, { isTempHealth = false } = {}) {
  if (isTempHealth) {
    await targetActor.update({ 'system.health.bonus': (targetActor.system.health.bonus ?? 0) + amount });
    return;
  }

  const wasDefeated = !!targetActor.statuses?.has?.('defeated');
  await targetActor.update({
    'system.health.value': Math.min(targetActor.system.health.max, targetActor.system.health.value + amount),
  });

  if (wasDefeated) {
    await targetActor.toggleStatusEffect('defeated', { active: false });
  }
}
