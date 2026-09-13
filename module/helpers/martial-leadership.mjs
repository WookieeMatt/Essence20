import { bankPendingBonus } from "./perks.mjs";

/**
 * Martial Leadership (Enigma of Combination, General Perk, p.41): "Persuasion is a Strength
 * Essence Skill for you in addition to a Social Essence Skill. As a Standard action, you can
 * attempt a Persuasion Skill Test against a target's Cleverness Defense. On a success, you can
 * choose to either impose ↓1 on the target's next Skill Test or grant Edge to the target's next
 * Skill Test."
 *
 * The Strength-Essence half is a plain compendium Active Effect
 * (system.skills.persuasion.essences.strength = true), the exact same generic multi-Essence-skill
 * mechanism Wrench Jockey/Terrifying Presence already use - no code needed for that half.
 *
 * This file covers the triggered-roll half: resolves the currently-targeted actor and triggers a
 * real Persuasion-vs-Cleverness roll via actor._dice.rollSkill() (the same "trigger a real dialog
 * roll" shape Duty Of The Graphite/Absolute Menace already establish, single-target instead of an
 * AoE). On success, a 2-option picker (Snag or Edge) - unlike Menacing Glare's own 3-way picker,
 * BOTH options here apply to the TARGET's own next roll (a positive or negative choice for
 * someone else, matching this Perk's own "lead or dissuade" flavor), so both bank an unscoped
 * flag on the target rather than a self-scoped one - same shape as Through the Arches' Snag/
 * Menacing Glare's own Snag half.
 */

const PENDING_SNAG_FLAG = 'pendingMartialLeadershipSnag';
const PENDING_EDGE_FLAG = 'pendingMartialLeadershipEdge';

/**
 * @returns {Promise<String|null>}   'snag' or 'edge', or null if cancelled.
 */
export async function pickMartialLeadershipEffect() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MartialLeadershipPickEffectTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MartialLeadershipPickEffectLabel')
    }</label><select name="effect">
      <option value="snag">${game.i18n.localize('E20.MartialLeadershipSnag')}</option>
      <option value="edge">${game.i18n.localize('E20.MartialLeadershipEdge')}</option>
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
 * Resolves the currently-targeted actor and triggers the Persuasion-vs-Cleverness roll. The
 * effect picker only runs afterward, in dice.mjs's own post-roll success handling.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>}   The target actor, or null if there was nothing valid to
 *   target (surfaced as a warning by the caller).
 */
export async function activateMartialLeadership(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  await actor._dice.rollSkill({
    skill: 'persuasion', essence: 'social', shiftUp: 0, shiftDown: 0, defenseType: 'cleverness',
    isMartialLeadershipAttempt: true, martialLeadershipTargetUuid: targetActor.uuid,
  }, actor);
  return targetActor;
}

/**
 * Prompts for and banks the chosen effect on the target - called from dice.mjs's own post-roll
 * success handling.
 * @param {Actor} targetActor
 * @returns {Promise<String|null>}   The effect banked, or null if the picker was cancelled.
 */
export async function applyMartialLeadershipEffect(targetActor) {
  const effect = await pickMartialLeadershipEffect();
  if (!effect) {
    return null;
  }

  await bankPendingBonus(targetActor, effect == 'snag' ? PENDING_SNAG_FLAG : PENDING_EDGE_FLAG);
  return effect;
}

export { PENDING_SNAG_FLAG, PENDING_EDGE_FLAG };
