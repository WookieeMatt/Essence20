import { actorHasHangUp } from "./perks.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Fun Exhaustion (MLP CRB, suggested Hang-Up, p.56): "Once you have used your Party Power Perk
 * once in the day, any subsequent uses annoy everyone. You still gain the Friendship Point, but
 * you cannot assist or be assisted by anyone else for the rest of the scene/encounter."
 *
 * "Once per day" is approximated as "once per scene" (this project's own standard idiom - see
 * helpers/trade-school.mjs's own identical comment), matching Party Power's own scene-scoped use
 * counter (helpers/banked-buffs.mjs#PARTY_POWER_SCENE_FLAG) it piggybacks on: the SECOND (and
 * every later) use this scene triggers the block, applied in banked-buffs.mjs's own Party Power
 * dispatch right after the Friendship Point grant. "Cannot assist or be assisted" is scoped to
 * this codebase's own Lend Assistance action (helpers/lend-assistance.mjs) - the only mechanic
 * this project's vocabulary calls "assist."
 */
export const FUN_EXHAUSTION_ID = "Compendium.essence20.mlp_crb.Item.FDd42qmdJBx0eTbE";

const BLOCKED_FLAG = 'funExhaustionBlocked';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function hasFunExhaustionHangUp(actor) {
  return actorHasHangUp(actor, FUN_EXHAUSTION_ID);
}

/**
 * Blocks this actor from assisting or being assisted for the rest of the current scene.
 * @param {Actor} actor
 */
export async function applyFunExhaustionBlock(actor) {
  await actor.setFlag('essence20', BLOCKED_FLAG, { epoch: getSceneEpoch() });
}

/**
 * Whether this actor is currently blocked from assisting/being assisted by Fun Exhaustion.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isBlockedByFunExhaustion(actor) {
  return actor?.getFlag?.('essence20', BLOCKED_FLAG)?.epoch === getSceneEpoch();
}
