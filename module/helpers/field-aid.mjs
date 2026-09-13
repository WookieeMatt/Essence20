import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Field Aid (GI Joe CRB, Focus: Medic, 3rd level, p.82): "your Movement increases by 10 feet
 * while heading in the direction of a Defeated ally. Dragging a Defeated ally of your size
 * doesn't cost you extra Movement, and you don't need to roll Brawn to drag them."
 *
 * "While heading in the direction of" has no hook to verify (this system doesn't track movement
 * direction relative to a target) - approximated as "any Defeated ally exists anywhere on the
 * scene" instead, the same "drop the unenforceable narrative precondition, grant the mechanical
 * half unconditionally" idiom Bits To Spare/Truthseeker/Fear My Name already use. The
 * no-extra-cost-to-drag and no-Brawn-roll clauses are pure narrative/GM-adjudicated - this system
 * has no drag/carry-encumbrance mechanic anywhere to waive a cost from.
 */

/**
 * Whether any allied token on the current scene is currently Defeated.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasNearbyDefeatedAlly(actor) {
  return getNearbyAllyTokens(actor, Infinity).some(token => token.actor?.statuses?.has('defeated'));
}
