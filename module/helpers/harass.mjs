import { registerRollSources } from "./extensions.mjs";
import { hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";
import { getSceneEpoch } from "./scene-clock.mjs";

/**
 * Harass (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.63): "As a Free action, you can
 * gain Edge on attacks until the beginning of your next turn."
 *
 * The Use button stamps how long it lasts (the start of this actor's next turn in the current
 * combat; the rest of the scene out of combat), and every Attack rolled while it's live lists the
 * Edge in the Roll Options Dialog - not just the first one. Once per turn: a second use would do
 * nothing new, the gate just gives the button a clean disable-on-use.
 */

// Kept for dice.mjs's older one-shot bank, which nothing writes any more.
const HARASS_EDGE_FLAG = 'pendingHarassEdge';
const HARASS_TURN_FLAG = 'harassUsedThisTurn';
export const HARASS_ACTIVE_FLAG = 'harassActive';

export function canUseHarass(actor) {
  return !hasUsedThisTurn(actor, HARASS_TURN_FLAG);
}

/**
 * When "the beginning of your next turn" is: the round and turn index of this actor's next turn.
 * @param {Actor} actor
 * @returns {Object}
 */
function untilNextTurn(actor) {
  const combat = game.combat;
  if (!combat) {
    return { sceneEpoch: getSceneEpoch() };
  }

  const theirs = combat.turns?.findIndex?.(c => c.actor?.id == actor?.id) ?? -1;
  const turn = theirs < 0 ? combat.turn : theirs;
  return {
    sceneEpoch: getSceneEpoch(),
    combatId: combat.id,
    untilRound: turn <= combat.turn ? combat.round + 1 : combat.round,
    untilTurn: turn,
  };
}

export async function activateHarass(actor) {
  await markUsedThisTurn(actor, HARASS_TURN_FLAG);
  await actor.setFlag('essence20', HARASS_ACTIVE_FLAG, untilNextTurn(actor));
}

/**
 * Whether Harass's Edge is still in effect.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isHarassActive(actor) {
  const stamp = actor?.getFlag?.('essence20', HARASS_ACTIVE_FLAG);
  if (!stamp || stamp.sceneEpoch != getSceneEpoch()) {
    return false;
  }

  if (stamp.combatId == null) {
    return true;
  }

  const combat = game.combat;
  if (!combat || combat.id != stamp.combatId) {
    return false;
  }

  return combat.round < stamp.untilRound || (combat.round == stamp.untilRound && combat.turn < stamp.untilTurn);
}

/** Roll Options Dialog: Edge on every Attack while Harass lasts. */
export function harassRollSources(actor, target, ctx = {}) {
  if (ctx.item?.type != 'weaponEffect' || !isHarassActive(actor)) {
    return { sources: [], consumes: [] };
  }

  return { sources: [{ id: 'harass', label: 'Harass', edge: true }], consumes: [] };
}

registerRollSources(harassRollSources);

export { HARASS_EDGE_FLAG };
