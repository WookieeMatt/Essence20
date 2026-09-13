/**
 * Explosive Aftershock (GI Joe CRB, Focus: Artillery, 15th level, p.81): "after comparing your
 * attack test to the Defense (usually Evasion) of your targets, compare your test total to their
 * Toughness Defense for the shockwave of force following the explosion. If you succeed, you may
 * choose two of the following: You knock them prone; You deafen them until the end of their next
 * turn; You push them 10 feet; They suffer -1 on all actions until the end of their next turn."
 *
 * The Toughness compare itself lives in dice.mjs (an independent second Defense check against the
 * same roll total - see isExplosiveAftershockAttack's own comment in rollSkill(), the same shape
 * Trigger Happy's own Willpower compare already establishes). This file covers the "choose two"
 * picker and the per-target application, both triggered once per roll from _rollSkillHelper's own
 * post-hit processing.
 *
 * "Push 10 feet" is left out of the choices - this codebase has no forced-movement mechanism
 * anywhere (the same gap Wrecking Ball/Illusion Confusion/Flower Power are already blocked on), so
 * there's nothing that option would actually do. The remaining 3 named effects give exactly 3 real
 * "choose 2" combinations, offered as a single select (this project's usual "pick one of N"
 * picker shape) - a true independent 2-of-4 checkbox picker has no precedent anywhere in this
 * codebase and isn't worth inventing for one 15th-level Perk this narrow.
 */
import { bankPendingBonus } from "./perks.mjs";

export const EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG = 'pendingExplosiveAftershockPenalty';

const OPTIONS = [
  { value: 'prone_deafened', label: 'E20.ExplosiveAftershockProneDeafened' },
  { value: 'prone_penalty', label: 'E20.ExplosiveAftershockPronePenalty' },
  { value: 'deafened_penalty', label: 'E20.ExplosiveAftershockDeafenedPenalty' },
];

/**
 * @returns {Promise<Array<String>|null>}   Two of 'prone'/'deafened'/'penalty', or null if
 *   cancelled.
 */
export async function pickExplosiveAftershockEffects() {
  const options = OPTIONS
    .map(o => `<option value="${o.value}">${game.i18n.localize(o.label)}</option>`)
    .join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.ExplosiveAftershockPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.ExplosiveAftershockPickLabel')
    }</label><select name="effects">${options}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.effects.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen.split('_') : null;
}

/**
 * @param {Actor} targetActor
 * @param {Array<String>} effects   Two of 'prone'/'deafened'/'penalty', from
 *   pickExplosiveAftershockEffects().
 */
export async function applyExplosiveAftershockEffects(targetActor, effects) {
  if (effects.includes('prone')) {
    await targetActor.toggleStatusEffect('prone', { active: true });
  }
  if (effects.includes('deafened')) {
    await targetActor.toggleStatusEffect('deafened', { active: true });
  }
  if (effects.includes('penalty')) {
    await bankPendingBonus(targetActor, EXPLOSIVE_AFTERSHOCK_PENALTY_FLAG, { shiftDown: 1 });
  }
}
