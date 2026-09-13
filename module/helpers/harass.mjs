import { bankPendingBonus, hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";

/**
 * Harass (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.63): "As a Free action, you can
 * gain Edge on attacks until the beginning of your next turn."
 *
 * A self-contained, player-triggered timed self-buff - the same bank-now/consume-on-the-actor's-
 * own-next-matching-roll idiom this project has built dozens of times, gated on isAttack ("Edge on
 * attacks," not any Skill Test) and once per turn (RAW states no frequency cap, but re-banking an
 * already-banked Edge is a no-op anyway - the gate exists for a clean, disable-on-use button, not
 * because a second use would do anything different).
 */

const HARASS_EDGE_FLAG = 'pendingHarassEdge';
const HARASS_TURN_FLAG = 'harassUsedThisTurn';

export function canUseHarass(actor) {
  return !hasUsedThisTurn(actor, HARASS_TURN_FLAG);
}

export async function activateHarass(actor) {
  await markUsedThisTurn(actor, HARASS_TURN_FLAG);
  await bankPendingBonus(actor, HARASS_EDGE_FLAG, { edge: true });
}

export { HARASS_EDGE_FLAG };
