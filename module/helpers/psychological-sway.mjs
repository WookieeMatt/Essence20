import { bankPendingBonus, postPerkUseChatCard } from "./perks.mjs";

/**
 * Psychological Sway (Enigma of Combination, Counselor Focus, 10th level, p.37): "when you Lend
 * Assistance, you can grant ↑2 (instead of the normal ↑1) to any ally who can hear your voice and
 * understand your words. Alternatively, as a Standard action, you can impose a ↓1 penalty on the
 * next Skill Test of a living foe who can hear your voice and understand your words."
 *
 * The Lend Assistance half lives in helpers/lend-assistance.mjs's own getAssistShiftUp (same
 * unconditional-upgrade shape as Putting Others Before Yourself). This file covers the second,
 * standalone half: a Use-button declaration banking a ↓1 on the currently-targeted foe's own next
 * Skill Test, consumed the same way Martial Leadership's own Snag half is (dice.mjs's
 * _getAutomaticCombatModifiers, unscoped to any particular roll type). "Who can hear your voice and
 * understand your words" is an unenforced narrative qualifier, same idiom this codebase already
 * accepts for similarly unverifiable conditions elsewhere.
 */
export const PSYCHOLOGICAL_SWAY_ID = "Compendium.essence20.enigma_of_combination.Item.whz44n9XJNJQIVVt";

export const PENDING_PSYCHOLOGICAL_SWAY_FLAG = 'pendingPsychologicalSwayDownshift';

/**
 * Banks the ↓1 on the currently-targeted actor's next Skill Test.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   false (and a warning) if nothing is targeted.
 */
export async function activatePsychologicalSway(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.PsychologicalSwayNoTarget'));
    return false;
  }

  await bankPendingBonus(targetActor, PENDING_PSYCHOLOGICAL_SWAY_FLAG, { shiftDown: 1 });
  postPerkUseChatCard(actor, game.i18n.format('E20.PsychologicalSwayActivated', {
    name: actor.name, target: targetActor.name,
  }));
  return true;
}
