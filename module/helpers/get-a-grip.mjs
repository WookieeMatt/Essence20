import { spend, refund } from "./action-economy.mjs";
import { E20 } from "./config.mjs";

/**
 * Get A Grip (Decepticon Directive, Shredder Focus, 3rd level, p.58): "when you successfully hit
 * a target that is no more than one Size Class larger than you with an unarmed combat attack, you
 * can spend two Free actions to inflict the Grappled condition on the same target." See
 * GET_A_GRIP_ID's own doc comment in dice.mjs for how the declared checkbox and unarmed-attack
 * gating reach this point; this file only handles the two mechanical pieces dice.mjs itself can't
 * generically express - the Size Class comparison and the Free-action spend.
 */

/**
 * Whether targetActor is a legal Get A Grip target for actor - "no more than one Size Class
 * larger than you", the same sizeOrder index-compare idiom Smash!/Brutal Might already establish.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
export function isWithinGetAGripSizeGate(actor, targetActor) {
  const sizeOrder = Object.keys(E20.actorSizes);
  const actorSizeIndex = sizeOrder.indexOf(actor?.system.size);
  const targetSizeIndex = sizeOrder.indexOf(targetActor?.system.size);
  if (actorSizeIndex == -1 || targetSizeIndex == -1) {
    return false;
  }

  return targetSizeIndex <= actorSizeIndex + 1;
}

/**
 * Spends two Free actions for Get A Grip, atomically - action-economy.mjs has no {free: 2}
 * actionType of its own (nothing else needs one), so this spends 'free' twice and refunds the
 * first if the second can't be afforded, rather than adding a cost key with a single caller.
 * @param {Actor} actor
 * @param {String} source   Human-readable cause for the action-economy log (the Perk's own name).
 * @returns {Promise<Boolean>}   Whether both Free actions were actually spent.
 */
export async function spendGetAGripFreeActions(actor, source) {
  const first = await spend(actor, 'free', { source });
  if (!first.ok) {
    return false;
  }

  const second = await spend(actor, 'free', { source });
  if (!second.ok) {
    if (first.spendId) {
      await refund(actor, first.spendId);
    }

    return false;
  }

  return true;
}
