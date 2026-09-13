import { getNearbyAllyTokens } from "./allies.mjs";
import { bankPendingBonus, getPendingBonus } from "./perks.mjs";

/**
 * Pack Attack (Cobra Codex, Vanguard Warthog Focus, 17th level, p.69): "When you successfully use
 * Growl to intimidate a creature, you can spend a Move action to grant the same shiftUp 1 to all
 * allies' attacks against that target until the beginning of your next turn."
 *
 * Growl's own successful use already banks GROWL_SHIFT_UP_FLAG ('pendingGrowlShiftUp') on the
 * actor, scoped to the target's id - and its consumption in
 * dice.mjs#_getAutomaticCombatModifiers has no actorHasPerk(Growl) gate at all, just a
 * targetId match. So Pack Attack needs no new dice.mjs code - it only needs to read the actor's
 * own still-pending Growl bank (proof Growl just succeeded and hasn't been consumed yet) and
 * broadcast that exact same {targetId} shape to every nearby ally, the same 60ft radius idiom
 * Team Focus/Environmental Assist already use (RAW states no radius of its own).
 */

const GROWL_SHIFT_UP_FLAG = 'pendingGrowlShiftUp';
const PACK_ATTACK_RADIUS_FEET = 60;

/**
 * Whether the actor has a live (unconsumed) Growl bank to broadcast from.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUsePackAttack(actor) {
  return !!getPendingBonus(actor, GROWL_SHIFT_UP_FLAG);
}

/**
 * Broadcasts the actor's own pending Growl bonus to every nearby ally.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether anything was actually broadcast.
 */
export async function activatePackAttack(actor) {
  const pendingGrowl = getPendingBonus(actor, GROWL_SHIFT_UP_FLAG);
  if (!pendingGrowl) {
    return false;
  }

  const allies = getNearbyAllyTokens(actor, PACK_ATTACK_RADIUS_FEET);
  for (const token of allies) {
    await bankPendingBonus(token.actor, GROWL_SHIFT_UP_FLAG, { targetId: pendingGrowl.targetId });
  }

  return allies.length > 0;
}
