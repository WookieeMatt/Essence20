/**
 * Unlucky (For You) (Beneath the Helmet, Dark Ranger, 13th level, p.40): "Whenever you
 * successfully target a character with an attack, that character suffers Snag on the next Skill
 * Test they make before the start of your next turn. If they fail this Skill Test and you are
 * aware of it, you gain 1 Terror. This Role Perk can only affect each target once per combat
 * scene."
 *
 * Only the Snag half is built - "if they fail it and you are aware of it, gain 1 Terror" would
 * need a genuinely new "watch a DIFFERENT actor's future roll outcome and credit a third party"
 * hook this codebase has no precedent for anywhere (every existing Terror-accrual trigger is
 * about the Dark Ranger's OWN roll, see helpers/terror.mjs), so it's left as a documented gap
 * rather than forced in.
 *
 * "Once per combat scene" per target uses the exact same once-per-attacker-per-combat shape
 * Splinter Defense's own checkAndMarkSplinterDefense already established, just tracked on the
 * ATTACKER (a set of already-affected target ids) instead of on the target (a set of already-
 * counted attacker ids) - Unlucky (For You)'s own limit is about which TARGETS this Dark Ranger
 * has already used it against, the mirror image of Splinter Defense's "which attackers have
 * already triggered against me."
 */
const UNLUCKY_FOR_YOU_AFFECTED_FLAG = 'unluckyForYouAffectedTargets';
export const UNLUCKY_FOR_YOU_SNAG_FLAG = 'pendingUnluckyForYouSnag';

/**
 * Whether Unlucky (For You) should still trigger against this target - true (and marks it used)
 * the first time this actor successfully attacks a given target in the current combat, false (and
 * does nothing) on any later hit against the same target before the combat ends.
 * @param {Actor} actor   The Dark Ranger who just hit.
 * @param {String} targetId   The target actor's own id.
 * @returns {Promise<Boolean>}
 */
export async function checkAndMarkUnluckyForYou(actor, targetId) {
  if (!game.combat) {
    return false;
  }

  const stored = actor.getFlag?.('essence20', UNLUCKY_FOR_YOU_AFFECTED_FLAG);
  const targetIds = stored?.combatId == game.combat.id ? stored.targetIds : [];
  if (targetIds.includes(targetId)) {
    return false;
  }

  await actor.setFlag('essence20', UNLUCKY_FOR_YOU_AFFECTED_FLAG, {
    combatId: game.combat.id,
    targetIds: [...targetIds, targetId],
  });
  return true;
}
