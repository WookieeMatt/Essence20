import { bankPendingBonus } from "./perks.mjs";
import { getDefenseValue } from "./combat.mjs";
import { findRolePointsItem } from "./reroll.mjs";

/**
 * Clever Mind (MLP CRB, Laugh Tactic, p.86): "Spend 1 Cheer to use Cleverness instead of one of
 * your other defenses."
 *
 * Unlike a skill substitution (helpers/skill-substitution-perks.mjs), where the player just
 * declares which of their own skills they're rolling, WHICH Defense an incoming attack compares
 * against is computed automatically by dice.mjs (getDefenseValue(actor, resolvedDefenseType)) - a
 * genuine dice-pipeline hook is needed to actually swap it. Modeled the same shape as the existing
 * "banked defense adjustment, consumed at the same difficulty += await consumeXXX(...) site as
 * Hard Target/Resilience/Momentary Blur" idiom (helpers/banked-buffs.mjs) - but instead of adding
 * a flat bonus, it returns the DELTA between the actor's own Cleverness Defense and whichever
 * Defense the attack actually rolled against, which folds into that same `difficulty +=` line and
 * so behaves exactly as if Cleverness had been compared instead.
 */
export const CLEVER_MIND_ID = "Compendium.essence20.mlp_crb.Item.34WtMHugUN7Wp5bP";
const CHEER_POINTS_NAME = "Cheer Points";
const CLEVER_MIND_FLAG = 'pendingCleverMindDefense';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseCleverMind(actor) {
  return (findRolePointsItem(actor, CHEER_POINTS_NAME)?.system.resource.value ?? 0) >= 1;
}

/**
 * Spends 1 Cheer Point and banks the pending Defense swap on the actor, consumed the next time
 * they're attacked (see consumeCleverMind below).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether the Cheer Point was actually spent.
 */
export async function activateCleverMind(actor) {
  const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
  if (!rolePoints?.system.resource.value) {
    ui.notifications.warn(game.i18n.localize('E20.RolePointsOverSpent'));
    return false;
  }

  await rolePoints.update({ 'system.resource.value': rolePoints.system.resource.value - 1 });
  await bankPendingBonus(actor, CLEVER_MIND_FLAG, {});
  return true;
}

/**
 * Reads (and, if present, consumes) the target's own banked Clever Mind swap, returning the
 * difficulty delta needed to make this attack compare against the target's Cleverness Defense
 * instead of whichever Defense it actually rolled against - 0 if not banked, or if the attack was
 * already targeting Cleverness (nothing to swap).
 * @param {Actor} targetActor
 * @param {String} defenseType   The Defense this attack actually resolved against.
 * @returns {Promise<Number>}
 */
export async function consumeCleverMind(targetActor, defenseType) {
  if (defenseType == 'cleverness' || !targetActor?.getFlag?.('essence20', CLEVER_MIND_FLAG)) {
    return 0;
  }

  await targetActor.unsetFlag('essence20', CLEVER_MIND_FLAG);
  return getDefenseValue(targetActor, 'cleverness') - getDefenseValue(targetActor, defenseType);
}
