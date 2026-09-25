import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * I've Got You (GI Joe CRB, Focus: Medic, 7th level, p.82): "At 7th level, when you roll a
 * Science (Medicine) Skill Test on a Defeated ally, they come back from defeat with 1 additional
 * Health."
 *
 * This entry was previously flagged as blocked on a base "recover a Defeated ally via Science
 * (Medicine) Skill Test" mechanic whose own rules were "not yet extracted" - RAW-verified
 * 2026-09-15 directly against the Core Rules Combat chapter (p.209-210, already cached in this
 * session's own scratchpad from an earlier extraction): "as a Standard action, Science Skill
 * Tests can restore Health to living creatures... The DIF of a Skill Test to restore Health is
 * equal to 5 + (5 per Health you want to restore)." That generic rule is the base mechanic this
 * whole cluster (I've Got You, Up And At 'Em, Stim Dart, Nano-Med Mastery, Regeneration's own
 * Science-Skill-Test half) was blocked on - built here as a reusable core, with I've Got You's own
 * +1-and-clear-Defeated bonus layered directly on top. The player picks how much Health they're
 * attempting to restore (the same bounded numeric picker Powered Plating already established), the
 * DIF is computed from RAW's own formula, and the actual Skill Test is a real interactive roll
 * (actor._dice.rollSkill() against a flat `dif`, the same "trigger a real dialog roll, read the
 * outcome back in post-hit processing" shape Rousing Comeback/Iron Hide already established) - on
 * a success, the CURRENTLY-TARGETED ally is healed by the chosen amount (same "read
 * game.user.targets.first() independently of how the difficulty was determined" idiom Panacea/
 * Duty Of The Graphite already use). Up And At 'Em/Stim Dart/Nano-Med Mastery/Regeneration's own
 * Science-Skill-Test half are natural follow-ons layering their own bonuses onto this same core,
 * not attempted this pass to keep this wave scoped to the one Perk actually named here.
 *
 * Up And At 'Em (GI Joe CRB, Focus: Medic, 10th level, p.82, built 2026-09-15 as a same-tick
 * follow-on): "after helping an ally recover from Defeat, they gain another additional Health as
 * part of the recovery in addition to the benefit from I've Got You. They also gain an Edge on
 * attacks and Skill Tests during their first turn after being revived." Layers directly onto
 * applyIveGotYouHeal below (RAW's own "in addition to the benefit from I've Got You" wording
 * confirms these two are meant to stack, not replace one another) - a further +1 when the medic
 * ALSO holds Up And At 'Em, plus an unscoped banked Edge on the healed target (same shape as
 * Menacing Glare's own Snag/Martial Leadership's own Edge - banked on the target, consumed on
 * their own next roll of any kind, "first turn" approximated as "next roll" per this project's
 * usual duration idiom), gated on the target having actually been Defeated (matching I've Got
 * You's own identical gate - "helping an ally recover from Defeat").
 */
export const IVE_GOT_YOU_ID = "Compendium.essence20.gi_joe_crb.Item.6wbY17kDGkxeGBPp";
export const UP_AND_AT_EM_ID = "Compendium.essence20.gi_joe_crb.Item.BYVxcL7hWHPDsIJL";
export const UP_AND_AT_EM_EDGE_FLAG = 'pendingUpAndAtEmEdge';
const MAX_AMOUNT = 6;

/**
 * Prompts for how much Health to attempt to restore (1 up to a generous bound - RAW's own DIF
 * formula makes anything higher increasingly implausible to succeed at anyway).
 * @returns {Promise<Number|null>}   The chosen amount, or null if cancelled/invalid.
 */
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
 * Prompts for a Health amount and triggers a real Science (Medicine) Skill Test against RAW's own
 * DIF formula, targeting whichever ally is currently targeted.
 * @param {Actor} actor
 */
export async function activateIveGotYou(actor) {
  if (!game.user.targets.first()) {
    ui.notifications.warn(game.i18n.localize('E20.IveGotYouNoTarget'));
    return;
  }

  const amount = await pickHealAmount();
  if (!amount) {
    return;
  }

  const dif = 5 + (5 * amount);
  await actor._dice.rollSkill({
    skill: 'science', essence: 'smarts', dif: String(dif), isIveGotYou: true, iveGotYouAmount: amount,
  }, actor);
}

/**
 * Applies the healing on a successful cast - called from dice.mjs's own post-roll success
 * handling. Restores the chosen amount, plus I've Got You's own +1 and a clear of Defeated if the
 * target was Defeated - plus Up And At 'Em's own further +1 and banked Edge if the healing actor
 * also holds that Perk.
 * @param {Actor} healTarget
 * @param {Number} amount
 * @param {Actor} actor   The medic who performed the heal - checked for Up And At 'Em.
 */
export async function applyIveGotYouHeal(healTarget, amount, actor) {
  const wasDefeated = !!healTarget.statuses?.has?.('defeated');
  const hasUpAndAtEm = wasDefeated && actorHasPerk(actor, UP_AND_AT_EM_ID);
  const totalHeal = amount + (wasDefeated ? 1 : 0) + (hasUpAndAtEm ? 1 : 0);

  await healTarget.update({
    'system.health.value': Math.min(healTarget.system.health.max, healTarget.system.health.value + totalHeal),
  });

  if (wasDefeated) {
    await healTarget.toggleStatusEffect('defeated', { active: false });
  }

  if (hasUpAndAtEm) {
    await bankPendingBonus(healTarget, UP_AND_AT_EM_EDGE_FLAG, { edge: true });
  }
}
