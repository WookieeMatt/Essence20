import { E20 } from "./config.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";

/**
 * Inspiring Words (GI Joe CRB, Vanguard base, 2nd level, p.109): "Twice per combat, but no more
 * than once a turn, you can inspire others with your heroic presence. As a Move action, you may
 * either grant an ally one Temporary Health, remove a Condition on them (other than Defeated), or
 * give them an upshift 2 on their next Skill Test."
 *
 * "Twice per combat, but no more than once a turn" is a genuinely new gate shape this project
 * hasn't needed before - hasUsedThisEncounter (perks.mjs) is a plain boolean, hasUsedThisTurn is
 * scoped to a single turn, but nothing combines "N uses total this encounter" with "at most 1 of
 * those per turn." Tracked as its own {combatId, usesRemaining} flag (reset to 2 whenever
 * combatId doesn't match the current combat, the same "stale flag from a finished encounter"
 * idiom hasUsedThisEncounter itself already establishes), checked alongside the existing
 * hasUsedThisTurn gate for the once-per-turn cap - both must pass for the button to be usable.
 *
 * The ally-targeting and effect-application orchestration lives in banked-buffs.mjs's own
 * onPerkUse dispatch (it already owns pickAllyTargets/bankPendingBonus) - this file covers the
 * new counter gate and the effect picker only. The remove-a-Condition option needs its own
 * dynamic option list (a near-duplicate of helpers/eltarian-mettle.mjs's own
 * pickEltarianMettleCondition, kept separate rather than widened to avoid any regression risk to
 * that already-shipped, tested Perk) since RAW lets the player remove ANY currently-active
 * Condition on the target, not a fixed list.
 */

const INSPIRING_WORDS_ENCOUNTER_FLAG = 'inspiringWordsUsesRemaining';
const INSPIRING_WORDS_TURN_FLAG = 'inspiringWordsUsedThisTurn';
const INSPIRING_WORDS_MAX_USES = 2;

/**
 * @param {Actor} actor
 * @returns {Number}
 */
function getInspiringWordsUsesRemaining(actor) {
  const stored = actor.getFlag?.('essence20', INSPIRING_WORDS_ENCOUNTER_FLAG);
  if (!stored || stored.combatId != game.combat?.id) {
    return INSPIRING_WORDS_MAX_USES;
  }

  return stored.usesRemaining;
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseInspiringWords(actor) {
  if (!game.combat || hasUsedThisTurn(actor, INSPIRING_WORDS_TURN_FLAG)) {
    return false;
  }

  return getInspiringWordsUsesRemaining(actor) > 0;
}

/**
 * Records one of the two per-encounter uses spent, and marks the turn used (the once-per-turn
 * half of the gate).
 * @param {Actor} actor
 */
export async function markInspiringWordsUsed(actor) {
  if (!game.combat) {
    return;
  }

  const usesRemaining = getInspiringWordsUsesRemaining(actor);
  await actor.setFlag('essence20', INSPIRING_WORDS_ENCOUNTER_FLAG, {
    combatId: game.combat.id,
    usesRemaining: Math.max(0, usesRemaining - 1),
  });
  await markUsedThisTurn(actor, INSPIRING_WORDS_TURN_FLAG);
}

/**
 * @returns {Promise<String|null>}   One of 'tempHealth'/'removeCondition'/'shiftUp', or null if
 *   cancelled.
 */
export async function pickInspiringWordsEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.InspiringWordsPickEffectTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.InspiringWordsPickEffectLabel')
    }</label><select name="effect">
      <option value="tempHealth">${game.i18n.localize('E20.InspiringWordsTempHealth')}</option>
      <option value="removeCondition">${game.i18n.localize('E20.InspiringWordsRemoveCondition')}</option>
      <option value="shiftUp">${game.i18n.localize('E20.InspiringWordsShiftUp')}</option>
    </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effect.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for which of the target's own currently-active Conditions (excluding Defeated) to
 * remove - see this file's own doc comment for why this doesn't reuse
 * eltarian-mettle.mjs#pickEltarianMettleCondition directly.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The chosen Condition key, or null if there's nothing to
 *   remove or the picker was cancelled.
 */
export async function pickInspiringWordsCondition(targetActor) {
  const activeConditions = E20.statusEffects
    .filter(status => status.id != 'defeated' && targetActor.statuses?.has(status.id));
  if (!activeConditions.length) {
    return null;
  }

  const options = activeConditions
    .map(status => `<option value="${status.id}">${game.i18n.localize(status.name)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.InspiringWordsPickConditionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.InspiringWordsPickConditionLabel')
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
