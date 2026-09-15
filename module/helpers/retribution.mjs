import { computeMultiplier } from "./combat.mjs";
import { actorHasPerk, bankPendingBonus } from "./perks.mjs";

/**
 * Retribution (Through the Shattered Grid, Magna Defender, 7th level, p.25): "Whenever you
 * activate your Defender Step and end adjacent to the enemy that triggered Defender Step, you can
 * spend 1 Personal Power to make a single melee Attack against that foe. You gain +1 damage if
 * the enemy still struck your ally or an Edge on the Retribution Attack if your Defender Step
 * caused the Attack to miss."
 *
 * See helpers/defender-step.mjs's own doc comment for the full picture: this file only handles
 * the "figure out which bonus applies, and bank it" half, called from dice.mjs's own
 * _rollSkillHelper results loop - the first point where the original attack's hit/miss is
 * actually known (Defender Step itself activates before the roll, with no idea yet how it'll
 * turn out). The banked bonus then surfaces as a Roll Options Dialog checkbox on the reactor's
 * own next melee attack, consumed directly in dice.mjs (the same "eligibility here, consumption
 * inline in dice.mjs" split Combat Stance's own damage-spend checkbox already uses).
 *
 * Only the two cases RAW actually grants a bonus for are banked - a Defender Step that turns out
 * to have been unnecessary (the attack was always going to miss, boosted Defense or not) still
 * lets the reactor narratively swing back, but with no determinable bonus to grant, RAW gives no
 * clear number to bank; not offering the checkbox in that case (rather than a bare, bonus-less
 * Retribution swing with nothing this system's dialog would actually add) is the judgment call
 * made here.
 */
export const RETRIBUTION_ID = "Compendium.essence20.through_the_shattered_grid.Item.cZtUjIzieAFxTwH2";
export const RETRIBUTION_PENDING_FLAG = 'pendingRetribution';

/**
 * @param {Object} entry       One of checkContext.entries (dice.mjs) - needs defenderStepBonus/
 *   defenderStepReactorUuid/difficulty, all set by dice.mjs's own per-target difficulty loop.
 * @param {Number} rollTotal   The attack's own resolved roll total.
 * @returns {String|null}   'damage', 'edge', or null (no bonus, and so nothing to bank).
 */
export function computeRetributionBonusType(entry, rollTotal) {
  if (!entry.defenderStepReactorUuid) {
    return null;
  }

  if (computeMultiplier(rollTotal, entry.difficulty) > 0) {
    // "The enemy still struck your ally" - hit even with Defender Step's own boost applied.
    return 'damage';
  }

  const wouldHaveHitWithoutTheBoost = computeMultiplier(rollTotal, entry.difficulty - entry.defenderStepBonus) > 0;
  // "Your Defender Step caused the Attack to miss" - would have hit without the boost, missed
  // with it. If it would have missed either way, Defender Step wasn't the deciding factor and
  // RAW grants no bonus to bank.
  return wouldHaveHitWithoutTheBoost ? 'edge' : null;
}

/**
 * Banks a Retribution bonus on the given reactor, scoped to the specific attacker who triggered
 * it. Called once per eligible entry after _rollSkillHelper's own (synchronous) results.map has
 * already run computeRetributionBonusType against each one - kept as a separate async step since
 * Array#map can't itself await this file's own actor lookup/setFlag calls.
 * @param {String} reactorUuid
 * @param {String} attackerUuid
 * @param {String} bonusType   'damage' or 'edge' - see computeRetributionBonusType above.
 */
export async function bankRetributionBonus(reactorUuid, attackerUuid, bonusType) {
  const reactor = await fromUuid(reactorUuid);
  // Defender Step (2nd level) and Retribution (7th level) are separate Role Perks - activating
  // Defender Step alone doesn't imply the reactor has reached Retribution's own level yet.
  if (!reactor || !actorHasPerk(reactor, RETRIBUTION_ID)) {
    return;
  }

  await bankPendingBonus(reactor, RETRIBUTION_PENDING_FLAG, { targetUuid: attackerUuid, bonusType });
}
