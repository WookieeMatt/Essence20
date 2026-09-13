import { E20 } from "./config.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { pickAllyTargets } from "./banked-buffs.mjs";

/**
 * EMT Crash Course (GI Joe CRB, General Perk, p.132) - see helpers/banked-buffs.mjs's own
 * EMT_CRASH_COURSE_ID comment for the full RAW text and why the heal/Essence-restore halves are
 * dispatched separately (different frequency caps - heal is once per scene, Essence-restore has
 * none). This file covers the Essence-restore half only; the heal half reuses
 * onImmediateAllyPerkUse directly (see banked-buffs.mjs).
 *
 * "Restore one Essence" reads as the same "+1 to one Essence score, capped at max" mechanic the
 * sheet's own Rest action already applies to every Essence at once
 * (sheet-handlers/listener-misc-handler.mjs) - here scoped to a single, player-chosen Essence on a
 * single ally, usable outside of a full rest.
 */

const ESSENCE_KEYS = Object.keys(E20.essences).filter(key => key != 'any');

/**
 * Prompts for which of the target's own currently-damaged Essences to restore by 1.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The chosen Essence key, or null if none are damaged or the
 *   picker was cancelled.
 */
export async function pickEmtCrashCourseEssence(targetActor) {
  const damagedEssences = ESSENCE_KEYS.filter(key => {
    const essence = targetActor.system.essences[key];
    return essence && essence.value < essence.max;
  });
  if (!damagedEssences.length) {
    return null;
  }

  const options = damagedEssences
    .map(key => `<option value="${key}">${game.i18n.localize(E20.essences[key])}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EmtCrashCoursePickEssenceTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.EmtCrashCoursePickEssenceLabel')
    }</label><select name="essence">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.essence.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for a target ally (or self) and, if they have a damaged Essence, restores one by 1.
 * @param {Actor} actor   The actor using the Perk.
 * @param {String} itemName   The Perk's own display name, for the ally-picker dialog's title.
 * @returns {Promise<Actor|null>}   The healed actor, or null if nothing was restored (no target
 *   chosen, or the target has no damaged Essence).
 */
export async function activateEmtCrashCourseEssenceRestore(actor, itemName) {
  const candidateAllies = [actor, ...getNearbyAllyTokens(actor, Infinity).map(token => token.actor).filter(Boolean)];
  const [targetActor] = await pickAllyTargets(actor, candidateAllies, itemName);
  if (!targetActor) {
    return null;
  }

  const essence = await pickEmtCrashCourseEssence(targetActor);
  if (!essence) {
    ui.notifications.warn(game.i18n.localize('E20.EmtCrashCourseNoDamagedEssence'));
    return null;
  }

  await targetActor.update({
    [`system.essences.${essence}.value`]: targetActor.system.essences[essence].value + 1,
  });

  return targetActor;
}
