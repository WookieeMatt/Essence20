import { E20 } from "./config.mjs";
import { getUsesThisScene, markUsedThisScene } from "./perks.mjs";

/**
 * Balance and Harmony (Factions in Action Vol. 2, Arashikage Faction Perk, p.9): "Once per scene,
 * as a Standard action, remove any Condition affecting you except Defeated and Unconscious."
 *
 * Same dynamic-option-list picker shape as helpers/eltarian-mettle.mjs#pickEltarianMettleCondition
 * (RAW lets the player remove ANY currently-active Condition, not a fixed list) - kept as its own
 * dedicated file rather than widened, matching this project's own established practice (Inspiring
 * Words' own near-duplicate picker cites the same reasoning) of not risking a regression to an
 * already-shipped Perk for a shape that isn't quite identical - this one excludes TWO statuses
 * (Defeated AND Unconscious) where Eltarian Mettle's own only excludes one.
 */
const BALANCE_AND_HARMONY_ENCOUNTER_FLAG = 'balanceAndHarmonyUsesThisScene';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseBalanceAndHarmony(actor) {
  return getUsesThisScene(actor, BALANCE_AND_HARMONY_ENCOUNTER_FLAG) < 1;
}

/**
 * Prompts for which of the actor's own currently-active Conditions (excluding Defeated and
 * Unconscious) to remove.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The chosen Condition key, or null if there's nothing to
 *   remove or the picker was cancelled.
 */
export async function pickBalanceAndHarmonyCondition(actor) {
  const activeConditions = E20.statusEffects
    .filter(status => !['defeated', 'unconscious'].includes(status.id) && actor.statuses?.has(status.id));
  if (!activeConditions.length) {
    return null;
  }

  const options = activeConditions
    .map(status => `<option value="${status.id}">${game.i18n.localize(status.name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.BalanceAndHarmonyPickConditionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.BalanceAndHarmonyPickConditionLabel')
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

/**
 * Prompts for and removes one of the actor's own active Conditions, once per scene.
 * @param {Actor} actor
 * @returns {Promise<String|null>}   The Condition actually removed, or null if not usable, nothing
 *   to remove, or the picker was cancelled.
 */
export async function applyBalanceAndHarmony(actor) {
  if (!canUseBalanceAndHarmony(actor)) {
    return null;
  }

  const condition = await pickBalanceAndHarmonyCondition(actor);
  if (!condition) {
    return null;
  }

  await actor.toggleStatusEffect(condition, { active: false });
  await markUsedThisScene(actor, BALANCE_AND_HARMONY_ENCOUNTER_FLAG);
  return condition;
}
