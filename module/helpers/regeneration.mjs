/**
 * Regeneration (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "When you
 * activate this power, the nanomites within your body repair 1 Health. This takes a Standard
 * action, but no roll is necessary. You may activate this power in tandem with a Science Skill
 * Test for normal healing. If you do so, then rather than gaining an automatic 1 Health you
 * instead gain Edge on the Science Skill Test. You may also use nanomites to aid another
 * character. This is resolved with a Science Skill Test as above."
 *
 * The plain, automatic self-heal (activateRegeneration below) was already built. The other two
 * clauses were previously flagged as needing "a generic 'heal an amount tied to a Skill Test's own
 * success' mechanism this codebase doesn't have anywhere" - that mechanism now exists, built for
 * I've Got You (see helpers/i-ve-got-you.mjs's own doc comment): a bounded amount picker, a real
 * flat-DIF Skill Test via actor._dice.rollSkill(), healing the target on success. Regeneration's
 * own twist is trading the guaranteed 1 Health for a real roll WITH EDGE (forced via a new
 * `isRegenerationAttempt` dataset flag joining dice.mjs's own skillDataset.edge OR-chain, the same
 * shape Linked/Relic Key's own forced-Edge sources already use) - no bonus beyond the chosen
 * amount (same as Mind Over Matter's own no-bonus shape), targeting whichever ally is currently
 * targeted, or the caster themselves with nothing targeted (covering both "in tandem with a
 * Science Skill Test" and "aid another character" in one flow, matching Healing Bandages' own
 * "Reach... or yourself" resolution). The player chooses which mode to activate via a small
 * picker (same 2-option DialogV2 shape used throughout this project for a binary choice).
 */
const REGENERATION_HEAL_AMOUNT = 1;
const MAX_AMOUNT = 6;

export async function activateRegeneration(actor) {
  await actor.update({
    'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + REGENERATION_HEAL_AMOUNT),
  });
}

/**
 * Prompts for whether to use the automatic 1-Health heal or a Science Skill Test (Edge, player-
 * chosen amount).
 * @returns {Promise<String|null>}   'automatic' or 'skillTest', or null if cancelled.
 */
async function pickRegenerationMode() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.RegenerationPickModeTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.RegenerationPickModeLabel')
    }</label><select name="mode">
      <option value="automatic">${game.i18n.localize('E20.RegenerationModeAutomatic')}</option>
      <option value="skillTest">${game.i18n.localize('E20.RegenerationModeSkillTest')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.mode.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

async function pickHealAmount() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.IveGotYouPickAmountTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.IveGotYouPickAmountLabel')
    }</label><input type="number" name="amount" min="1" max="${MAX_AMOUNT}" value="1" /></div>`,
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

  return Number.isInteger(chosen) && chosen > 0 ? Math.min(chosen, MAX_AMOUNT) : null;
}

/**
 * Prompts for a mode, then either applies the automatic heal or triggers the Science Skill Test
 * (with Edge) targeting whichever ally is currently targeted, or the caster themselves.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether a mode was actually chosen (false if either picker was
 *   cancelled) - callers use this to decide whether to post a "used" chat card.
 */
export async function activateRegenerationChoice(actor) {
  const mode = await pickRegenerationMode();
  if (!mode) {
    return false;
  }

  if (mode == 'automatic') {
    await activateRegeneration(actor);
    return true;
  }

  const amount = await pickHealAmount();
  if (!amount) {
    return false;
  }

  const dif = 5 + (5 * amount);
  await actor._dice.rollSkill({
    skill: 'science', essence: 'smarts', dif: String(dif), isRegeneration: true, regenerationAmount: amount,
  }, actor);
  return true;
}

/**
 * Applies the healing on a successful Science Skill Test cast - called from dice.mjs's own
 * post-roll success handling. No bonus beyond the chosen amount, but still clears Defeated if the
 * target was Defeated (the Core Rules' own general rule, same as I've Got You/Mind Over Matter).
 * @param {Actor} healTarget
 * @param {Number} amount
 */
export async function applyRegenerationHeal(healTarget, amount) {
  const wasDefeated = !!healTarget.statuses?.has?.('defeated');

  await healTarget.update({
    'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + amount),
  });

  if (wasDefeated) {
    await healTarget.toggleStatusEffect('defeated', { active: false });
  }
}
