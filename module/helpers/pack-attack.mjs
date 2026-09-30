import { getNearbyAllyTokens } from "./allies.mjs";
import { getPendingBonus } from "./perks.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Pack Attack (Cobra Codex, Vanguard Warthog Focus, 17th level, p.69): "When you successfully use
 * Growl to intimidate a creature, you can spend a Move action to grant the same shiftUp 1 to all
 * allies' attacks against that target until the beginning of your next turn."
 *
 * Growl's own successful use banks GROWL_SHIFT_UP_FLAG ('pendingGrowlShiftUp') on the actor,
 * scoped to the target's id - so a live bank is proof Growl just succeeded and hasn't been spent
 * yet, which is what gates the Use button. Every ally within 60ft (the same radius idiom Team
 * Focus/Environmental Assist use - RAW states none) then gets a PACK_ATTACK_FLAG record naming that
 * target and when the grant runs out: the start of the Pack Attack user's next turn in Combat, the
 * end of the scene out of it. It is NOT consumed by an attack - every attack the ally makes
 * against that target until then gets the ↑1, read by packAttackShiftUp below and listed as its
 * own Roll Options Dialog source by helpers/extensions/fix3-gij/gij-fixes.mjs. (It used to hand
 * each ally a copy of the one-shot Growl bank, which their first attack spent.)
 */

const GROWL_SHIFT_UP_FLAG = 'pendingGrowlShiftUp';
const PACK_ATTACK_RADIUS_FEET = 60;
export const PACK_ATTACK_FLAG = 'packAttackGrowl';

/**
 * Whether the actor has a live (unconsumed) Growl bank to broadcast from.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUsePackAttack(actor) {
  return !!getPendingBonus(actor, GROWL_SHIFT_UP_FLAG);
}

/**
 * "Until the beginning of your next turn": the last round/turn index the grant still covers -
 * the turn just before the user's own next one. Out of Combat there are no turns, so it lasts
 * for the rest of the scene.
 * @param {Actor} actor   The Pack Attack user.
 * @returns {Object}
 */
function untilStartOfNextTurn(actor) {
  const record = { sceneEpoch: getSceneEpoch() };
  const combat = game?.combat;
  if (!combat) {
    return record;
  }

  const theirs = combat.turns?.findIndex?.(c => c.actor?.id == actor?.id) ?? -1;
  const turn = Number(combat.turn) || 0;
  const round = Number(combat.round) || 0;
  if (theirs < 0) {
    return { ...record, combatId: combat.id, untilRound: round + 1, untilTurn: turn - 1 };
  }

  // Their next turn is later this round if it hasn't come up yet, else next round.
  return { ...record, combatId: combat.id, untilRound: theirs > turn ? round : round + 1, untilTurn: theirs - 1 };
}

function isLive(record) {
  if (!record || record.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (!record.combatId) {
    return true;
  }

  const combat = game?.combat;
  if (!combat || combat.id != record.combatId) {
    return false;
  }

  const round = Number(combat.round) || 0;
  const turn = Number(combat.turn) || 0;
  return round < record.untilRound || (round == record.untilRound && turn <= record.untilTurn);
}

/**
 * The Pack Attack grant an ally holds against this target, if it's still running.
 * @param {Actor} ally     The attacker.
 * @param {Actor} target   Who they're attacking.
 * @returns {Object|null}  The record ({targetId, label, ...}), or null.
 */
export function packAttackGrant(ally, target) {
  const record = ally?.getFlag?.('essence20', PACK_ATTACK_FLAG);
  return target?.id && record?.targetId == target.id && isLive(record) ? record : null;
}

/**
 * Grants the actor's pending Growl ↑1 to every nearby ally's attacks against the Growled target.
 * @param {Actor} actor
 * @param {String} [label]   The Perk's own name, shown as the source in the ally's dialog.
 * @returns {Promise<Boolean>}   Whether anything was actually granted.
 */
export async function activatePackAttack(actor, label = 'Pack Attack') {
  const pendingGrowl = getPendingBonus(actor, GROWL_SHIFT_UP_FLAG);
  if (!pendingGrowl) {
    return false;
  }

  const allies = getNearbyAllyTokens(actor, PACK_ATTACK_RADIUS_FEET);
  const record = { targetId: pendingGrowl.targetId, label, ...untilStartOfNextTurn(actor) };
  for (const token of allies) {
    await token.actor.setFlag('essence20', PACK_ATTACK_FLAG, record);
  }

  return allies.length > 0;
}
