import { actorHasPerk } from "../characters/perks.mjs";
import { getNearbyAllyTokens } from "./nearby-allies.mjs";
import { isGreasedLightningActive } from "../../items/magic/greased-lightning.mjs";
import { isCalmingWordsBuffActive } from "../../items/social/calming-words.mjs";
import { ruleConditionImmune } from "../../rules/adapter.mjs";

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

// Perk -> the Conditions it grants immunity to, for the holder only. Each entry is a literal
// transcription of a real "you are immune to the X, Y, and Z Conditions" grant - not a guess at
// what a Perk might cover.
// Most of these are ConditionImmunity rules on their own items now (rules/adapter.mjs#ruleConditionImmune):
// Caution, Ambush Master, Shape Shifter, Indomitable, Keep Your Cool, Righteous Heart, Mind of No Mind,
// Always Alert (every printing), Rapid Deployment Drills, True Self, Power From Loss, Get Low,
// Battlefield Titan's aura and Stalk (with check:outsideEnvironmentOfExpertise). What's left reads a
// state the rules don't track.
const CONDITION_IMMUNITY_PERKS = [
  // (Dig In's Prone immunity while dug in and Bulwark's Frightened immunity while planted are ConditionImmunity rules on
  // their Perks.)
  {
    // Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // items/magic/greased-lightning.mjs's own doc comment. A spell-granted temporary flag, not a
    // permanently-held Perk - uses `checkFn` (an alternate to every other entry's `id` +
    // actorHasPerk shape) to check the actor's own flag directly instead.
    checkFn: isGreasedLightningActive,
    conditions: ['restrained', 'grappled'],
  },
  {
    // Calming Words (Enigma of Combination, Counselor Focus, 3rd level, p.34) - see
    // items/social/calming-words.mjs's own doc comment. Same flag-based checkFn shape as Greased
    // Lightning above - a roll-granted temporary buff, not a permanently-held Perk.
    checkFn: isCalmingWordsBuffActive,
    conditions: ['frightened', 'mesmerized'],
  },
];

// Perk -> the Conditions it grants immunity to for the holder AND allies within radiusFeet (an
// aura). getNearbyAllyTokens (mechanics/combat/nearby-allies.mjs) is the same Disposition-based "ally" proxy
// getShieldUpgradeBonus/Enemy Number One already use elsewhere in this codebase.
const CONDITION_IMMUNITY_AURA_PERKS = [
];

/**
 * Whether the given actor is immune to a specific Condition (a CONFIG.statusEffects id, e.g.
 * 'frightened') via any Perk in the tables above - its own, or a nearby ally's aura.
 * @param {Actor} actor
 * @param {String} statusId
 * @returns {Boolean}
 */
export function isImmuneToCondition(actor, statusId) {
  const grantsSelf = entry => entry.conditions.includes(statusId)
    && (entry.checkFn
      ? entry.checkFn(actor)
      : actorHasPerk(actor, entry.id) && (!entry.isActive || entry.isActive(actor)));
  if (CONDITION_IMMUNITY_PERKS.some(grantsSelf) || CONDITION_IMMUNITY_AURA_PERKS.some(grantsSelf)) {
    return true;
  }

  // ConditionImmunity item rules - the holder's own, or reaching it as an aura, Party or link.
  if (ruleConditionImmune(actor, statusId)) {
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
