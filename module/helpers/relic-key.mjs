import { actorHasZordFeature } from "./zord-features.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Relic Key (PR CRB, Zord Feature, p.140): "The Zord may choose to have Edge on any one roll in
 * the scene." (The Smarts/Social-default-3-while-unpiloted half lives in helpers/combat.mjs's own
 * getDefenseValue instead - a different clause of the same Feature.) "May choose" makes this a
 * player-declared toggle, not an automatic grant - the same "spends a limited resource, left as a
 * manual choice" reasoning dice.mjs's own Reckless Abandon comment already establishes for every
 * other player-consent-gated grant in this codebase. Modeled as a declare-then-consume pair, the
 * same idiom helpers/combat-stance.mjs's own declareCombatStance/checkCombatStance already use for
 * a per-scene declaration, simplified to a plain boolean (no target to track) and to "the very
 * next roll" instead of "until an ending condition" (RAW says "on any ONE roll," not an ongoing
 * effect) - declaring it sets an active flag, the next roll that actually reads it clears the flag
 * again via consumeRelicKeyEdge.
 */
const RELIC_KEY_ID = "Compendium.essence20.pr_crb.Item.uSlClAv3oJjf54pa";
const RELIC_KEY_ENCOUNTER_FLAG = 'relicKeyUsedThisEncounter';
const RELIC_KEY_EDGE_FLAG = 'relicKeyEdgeActive';

/**
 * Whether this Zord can declare Relic Key's Edge right now - holds the Feature, hasn't already
 * declared it this encounter, and isn't already sitting on an undeclared-but-active grant.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canDeclareRelicKeyEdge(actor) {
  return actor?.type == 'zord' && actorHasZordFeature(actor, RELIC_KEY_ID)
    && !hasUsedThisEncounter(actor, RELIC_KEY_ENCOUNTER_FLAG) && !actor.getFlag('essence20', RELIC_KEY_EDGE_FLAG);
}

/**
 * Declares Relic Key's Edge, active until the next roll that actually consumes it.
 * @param {Actor} actor
 */
export async function declareRelicKeyEdge(actor) {
  await actor.setFlag('essence20', RELIC_KEY_EDGE_FLAG, true);
  await markUsedThisEncounter(actor, RELIC_KEY_ENCOUNTER_FLAG);
}

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isRelicKeyEdgeActive(actor) {
  return !!actor?.getFlag?.('essence20', RELIC_KEY_EDGE_FLAG);
}

/**
 * Clears the active flag - called once a roll has actually granted the Edge, so "any ONE roll"
 * doesn't linger into every roll for the rest of the scene.
 * @param {Actor} actor
 */
export async function consumeRelicKeyEdge(actor) {
  await actor.unsetFlag?.('essence20', RELIC_KEY_EDGE_FLAG);
}

export { RELIC_KEY_ID };
