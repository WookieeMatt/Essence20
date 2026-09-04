import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";

/**
 * Generic Condition-immunity enforcement. Several Perks across the GI Joe CRB grant outright
 * immunity to specific Conditions, either for the holder alone (Caution) or for the holder AND
 * nearby allies (Battlefield Titan, an aura) - these two tables are the one place that maps a
 * Perk to the Conditions it blocks, and isImmuneToCondition() is the one check every
 * immunity-granting Perk shares. The actual enforcement lives in essence20.mjs's own
 * `preCreateActiveEffect` hook, which is where a Condition is actually applied to an actor in this
 * system (Foundry's own Actor#toggleStatusEffect, used by the Token HUD, creates an ActiveEffect
 * carrying the status id) - this file only answers "is this actor immune," not "how do Conditions
 * get applied" in the first place.
 */

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";

// Perk -> the Conditions it grants immunity to, for the holder only. Each entry is a literal
// transcription of a real "you are immune to the X, Y, and Z Conditions" grant - not a guess at
// what a Perk might cover.
const CONDITION_IMMUNITY_PERKS = [
  {
    // Caution (Bodyguard Focus, 17th level, p.110): "you are immune to the Blinded, Deafened,
    // Frightened, Immobilized, Restrained, and Stunned Conditions."
    id: `${GI_JOE_CRB}pJcXVybdqjcWHpJq`,
    conditions: ['blinded', 'deafened', 'frightened', 'immobilized', 'restrained', 'stunned'],
  },
];

// Perk -> the Conditions it grants immunity to for the holder AND allies within radiusFeet (an
// aura). getNearbyAllyTokens (helpers/allies.mjs) is the same Disposition-based "ally" proxy
// getShieldUpgradeBonus/Enemy Number One already use elsewhere in this codebase.
const CONDITION_IMMUNITY_AURA_PERKS = [
  {
    // Battlefield Titan (Vanguard Focus, 9th level, p.109): "You and allies within 10 feet of
    // you are immune to Mesmerized and Frightened Conditions."
    id: `${GI_JOE_CRB}xsFS0pGQFx1w2qTd`,
    conditions: ['mesmerized', 'frightened'],
    radiusFeet: 10,
  },
];

/**
 * Whether the given actor is immune to a specific Condition (a CONFIG.statusEffects id, e.g.
 * 'frightened') via any Perk in the tables above - its own, or a nearby ally's aura.
 * @param {Actor} actor
 * @param {String} statusId
 * @returns {Boolean}
 */
export function isImmuneToCondition(actor, statusId) {
  const grantsSelf = entry => entry.conditions.includes(statusId) && actorHasPerk(actor, entry.id);
  if (CONDITION_IMMUNITY_PERKS.some(grantsSelf) || CONDITION_IMMUNITY_AURA_PERKS.some(grantsSelf)) {
    return true;
  }

  for (const entry of CONDITION_IMMUNITY_AURA_PERKS) {
    if (entry.conditions.includes(statusId)) {
      const nearbyAllies = getNearbyAllyTokens(actor, entry.radiusFeet);
      if (nearbyAllies.some(token => actorHasPerk(token.actor, entry.id))) {
        return true;
      }
    }
  }

  return false;
}
