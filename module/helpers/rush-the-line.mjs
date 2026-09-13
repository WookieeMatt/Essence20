import { bankPendingBonus } from "./perks.mjs";

/**
 * Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68): "You may spend a Story Point
 * once per turn to double your Movement as a Move action. If you make a melee Attack at the end
 * of your Move, your Attack gains Edge."
 *
 * "Double your Movement" is read as ground Movement specifically (this system's own default
 * "Movement" stat, the same reading Power Adaptation's own "Increase Movement by 20 feet" already
 * uses) - a plain on/off flag read live in documents/actor.mjs#_prepareMovement as a `*= 2`, the
 * same shape Lightning Speed's own identical doubling already establishes. Cleared automatically
 * at the end of the activating actor's own turn (essence20.mjs's own combatTurn/combatRound hook,
 * the same "read combat.combatant BEFORE the update commits" idiom Regenerating Shell's own
 * turn-end heal already uses) - unlike most manually-toggled flags in this project, this one has
 * a real, precise end-of-turn boundary to clear against, so it doesn't need to be left to the
 * player to notice and toggle off themselves.
 *
 * The Edge-on-a-following-melee-Attack half is a plain banked self-Edge (bankPendingBonus,
 * consumed the same generic way Think On It's own self-bank already is) - "at the end of your
 * Move" is approximated as "your next melee Attack this turn," the same "next matching roll"
 * simplification this project's duration-based grants already use throughout.
 */
const RUSH_THE_LINE_FLAG = 'rushTheLineActive';
export const PENDING_RUSH_THE_LINE_EDGE_FLAG = 'pendingRushTheLineEdge';

export function isRushTheLineActive(actor) {
  return !!actor.getFlag?.('essence20', RUSH_THE_LINE_FLAG);
}

/**
 * Activates Rush the Line's own Movement double and banks the follow-up melee Edge. Caller is
 * responsible for spending the Story Point and the once-per-turn gate (see banked-buffs.mjs).
 * @param {Actor} actor
 */
export async function activateRushTheLine(actor) {
  await actor.setFlag('essence20', RUSH_THE_LINE_FLAG, true);
  await bankPendingBonus(actor, PENDING_RUSH_THE_LINE_EDGE_FLAG, { edge: true });
}

/**
 * Clears the Movement double at the end of the activating actor's own turn - see this file's own
 * doc comment for why this one gets an active end-of-turn hook instead of a manual toggle.
 * @param {Actor} actor
 */
export async function deactivateRushTheLineAtTurnEnd(actor) {
  if (isRushTheLineActive(actor)) {
    await actor.setFlag('essence20', RUSH_THE_LINE_FLAG, false);
  }
}
