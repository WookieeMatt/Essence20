import { getNearbyAllyTokens } from "./allies.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { requestStoryPointGrant } from "./story-points.mjs";

/**
 * Uninterrupted Break (Quartermaster's Guide to Gear, General Perk, p.28): "By forcing yourself
 * and your team to take an uninterrupted 10-minute rest, you can rejuvenate their spirits. Select
 * one of the following benefits to apply at the end of this time period. Each benefit may only be
 * gained once per day.
 * - All allies heal 2 points of damage.
 * - All allies heal 1 point of Essence damage.
 * - The team gains 1 Story Point."
 *
 * "Once per day" is approximated as once per scene, this project's standard idiom - but tracked
 * as THREE independent flags (one per benefit), matching RAW's own "each benefit" wording, rather
 * than one shared gate that would wrongly block picking a still-unused benefit after another one
 * was already spent this scene.
 *
 * Only 2 of the 3 benefits are offered: "heal 1 point of Essence damage" is confirmed infra-
 * blocked - this codebase has no Essence-score damage application anywhere at all (the same gap
 * already found blocking Survivor's (PR CRB Influence Perk) identical "restore Essence" clause and
 * Plant Plasticity's (Technorganic Secrets) own rest-recovery clause) - matching this project's
 * own "don't offer a choice with nothing behind it" idiom (Grid Surge's own 4th option, etc.).
 * "Yourself and your team" includes the granter (unlike One For All/Power Burst/Shining Leader's
 * own "your teammates" wording), so the heal broadcast uses includeSelf.
 */
const UNINTERRUPTED_BREAK_HEAL_FLAG = 'uninterruptedBreakHealUsedThisEncounter';
const UNINTERRUPTED_BREAK_STORY_POINT_FLAG = 'uninterruptedBreakStoryPointUsedThisEncounter';

export function canUseUninterruptedBreak(actor) {
  return !hasUsedThisEncounter(actor, UNINTERRUPTED_BREAK_HEAL_FLAG)
    || !hasUsedThisEncounter(actor, UNINTERRUPTED_BREAK_STORY_POINT_FLAG);
}

/**
 * Prompts for which still-available benefit to apply - only offers the ones not yet used this
 * scene, matching each benefit's own independent "once per day" cap.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   'heal' or 'storyPoint', or null if cancelled/nothing available.
 */
export async function pickUninterruptedBreakBenefit(actor) {
  const options = [];
  if (!hasUsedThisEncounter(actor, UNINTERRUPTED_BREAK_HEAL_FLAG)) {
    options.push(`<option value="heal">${game.i18n.localize('E20.UninterruptedBreakHealOption')}</option>`);
  }
  if (!hasUsedThisEncounter(actor, UNINTERRUPTED_BREAK_STORY_POINT_FLAG)) {
    options.push(`<option value="storyPoint">${game.i18n.localize('E20.UninterruptedBreakStoryPointOption')}</option>`);
  }
  if (!options.length) {
    return null;
  }

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.UninterruptedBreakPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.UninterruptedBreakPickLabel')
    }</label><select name="benefit">${options.join('')}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.benefit.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Applies the chosen benefit and marks that specific benefit used this scene.
 * @param {Actor} actor
 * @param {String} benefit   pickUninterruptedBreakBenefit's own return value.
 */
export async function applyUninterruptedBreakBenefit(actor, benefit) {
  if (benefit == 'heal') {
    const targets = [actor, ...getNearbyAllyTokens(actor, Infinity).map(token => token.actor)];
    for (const target of targets) {
      const newHealth = Math.min(target.system.health.value + 2, target.system.health.max);
      await target.update({ 'system.health.value': newHealth });
    }
    await markUsedThisEncounter(actor, UNINTERRUPTED_BREAK_HEAL_FLAG);
  } else if (benefit == 'storyPoint') {
    requestStoryPointGrant(actor);
    await markUsedThisEncounter(actor, UNINTERRUPTED_BREAK_STORY_POINT_FLAG);
  }
}
