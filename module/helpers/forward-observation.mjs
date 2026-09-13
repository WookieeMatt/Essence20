import { getNearbyAllyTokens } from "./allies.mjs";
import { bankPendingBonus } from "./perks.mjs";

/**
 * Forward Observation (General Hawk's Personnel Files, General Perk, p.175): "Outside of combat,
 * you can spend 10 minutes observing an area and make a DIF 15 Alertness Skill Test. If you
 * succeed, you and all allies within 30 feet of you when you roll Initiative gain an upshift 1 on
 * their first Attack Skill Test in the next combat that takes place there within 24 hours."
 *
 * Triggers a real flat-DIF Skill Test via actor._dice.rollSkill() - the same "no click-to-place
 * target, dispatch straight into the interactive Roll Options Dialog" shape Absolute Menace/
 * Duty Of The Graphite/Elemental Storm already establish for a self-contained prep roll, just
 * with no target at all (a plain dataset.dif entry rather than a per-enemy comparison) - see
 * dice.mjs's own isForwardObservationAttempt flag and post-hit broadcast.
 *
 * "You and all allies within 30 feet of you WHEN YOU ROLL INITIATIVE" is approximated as "within
 * 30 feet of you right now" (this system has no way to re-evaluate who's nearby at a future,
 * as-yet-unscheduled Initiative roll) - the binoculars gear grant is unenforced inventory
 * bookkeeping, same as every other kit-grant clause in this book.
 */
export async function activateForwardObservation(actor) {
  await actor._dice.rollSkill(
    { skill: 'alertness', essence: 'smarts', dif: 15, isForwardObservation: true }, actor,
  );
}

/**
 * Banks the "upshift 1 on your next Attack Skill Test" flag on the granter and every nearby ally,
 * called from dice.mjs's own post-hit processing once the DIF 15 Alertness Test above succeeds.
 * "The next combat that takes place there within 24 hours" is approximated as "each target's own
 * next Skill Test," the same simplification every other banked-shiftUp-on-an-ally grant in
 * dice.mjs already applies (Plan of Action/Heart of the Team/Augment Power/etc. - none of them
 * gate consumption on isAttack either, despite RAW naming "Attack Skill Test" specifically).
 * @param {Actor} actor
 */
export async function broadcastForwardObservation(actor) {
  const nearbyAllies = getNearbyAllyTokens(actor, 30).map(token => token.actor).filter(Boolean);
  for (const target of [actor, ...nearbyAllies]) {
    await bankPendingBonus(target, 'pendingForwardObservation', { shiftUp: 1 });
  }
}
