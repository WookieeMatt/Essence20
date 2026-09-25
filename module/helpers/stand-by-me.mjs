import { getNearbyAllyTokens } from "./allies.mjs";
import { actorHasPerk } from "./perks.mjs";

/**
 * Stand By Me (MLP CRB, Loyalty, 2nd level, p.90): "No one hurts your friends! When you're
 * standing next to a friend, they gain a +1 bonus to their Defenses. If a friend you're standing
 * next to gets targeted by an effect and you don't, you can spend a Friendship Point to be the
 * target of the effect instead."
 *
 * This entry was previously miscategorized against a "no Guard/redirect-attack mechanism" gap -
 * this project already HAS a real damage-redirect mechanism (helpers/interpose.mjs, built for GI
 * Joe's Interpose/Body Shield/Heroic Sacrifice, already reused once this session for Story of the
 * Seasons' own same-named Interpose) - it was simply never connected here. The redirect half is
 * built there (see INTERPOSE candidates), not in this file, since it's the same mechanism, just
 * cost-gated on a Friendship Point (MLP's own relabel of the shared, world-scoped Story Points
 * pool) instead of free/unconditional.
 *
 * This file covers the OTHER half, which the original categorization missed entirely: a live,
 * non-consumed +1 bonus to ALL FOUR Defenses for any adjacent friend, read directly in dice.mjs's
 * per-target checkEntries construction (same "can't touch _prepareDefenses" workaround Powered
 * Plating/Phantom Suite/Lightshield Armor already established) - applies to the DEFENDING actor
 * regardless of which specific Defense the attack compares against, unlike those single-Defense
 * examples.
 */
const STAND_BY_ME_ID = "Compendium.essence20.mlp_crb.Item.LrcbTJQdNJVyu23f";
const ADJACENT_FEET = 5;
const STAND_BY_ME_BONUS = 1;

/**
 * Whether targetActor has an adjacent friend holding Stand By Me right now.
 * @param {Actor} targetActor
 * @returns {Number}   The Defense bonus to apply (0 if none).
 */
export function getStandByMeDefenseBonus(targetActor) {
  const nearbyAllies = getNearbyAllyTokens(targetActor, ADJACENT_FEET);
  return nearbyAllies.some(token => actorHasPerk(token.actor, STAND_BY_ME_ID)) ? STAND_BY_ME_BONUS : 0;
}

export { STAND_BY_ME_ID };
