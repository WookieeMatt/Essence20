import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { isDugIn } from "./dig-in.mjs";
import { isBulwarkActive } from "./bulwark.mjs";
import { isGreasedLightningActive } from "./greased-lightning.mjs";
import { isCalmingWordsBuffActive } from "./calming-words.mjs";
import { isIronBravadoFrightenedImmune } from "./iron-bravado.mjs";
import { isKnownOutsideEnvironmentOfExpertise } from "./environmental-expertise.mjs";
import { ruleConditionImmune } from "../rules/adapter.mjs";

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
const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";

// Perk -> the Conditions it grants immunity to, for the holder only. Each entry is a literal
// transcription of a real "you are immune to the X, Y, and Z Conditions" grant - not a guess at
// what a Perk might cover.
// Most of these are ConditionImmunity rules on their own items now (rules/adapter.mjs#ruleConditionImmune):
// Caution, Ambush Master, Shape Shifter, Indomitable, Keep Your Cool, Righteous Heart, Mind of No Mind,
// Always Alert (every printing), Rapid Deployment Drills, True Self, Power From Loss, Get Low and
// Battlefield Titan's aura. What's left reads a state the rules don't track.
const CONDITION_IMMUNITY_PERKS = [
  {
    // Stalk (GI Joe CRB, Predator base, 1st level, p.93): "any time you are in your environment
    // of expertise, you can not be surprised, and gain an Edge on Infiltration Skill Tests."
    // (Its Infiltration Edge is helpers/extensions/gij3's, gated on the same environment check.)
    // The first Perk to key off the Surprised status, added the same day (helpers/config.mjs) -
    // before it there was no Condition for this clause to name.
    //
    // "In your environment of expertise" is checked against the scene's terrain when the GM has
    // set one (helpers/environmental-expertise.mjs): outside every environment of expertise, with
    // no Adaptation / Read The Land flag covering it, the immunity is off. On a scene with no
    // terrain set it stays unconditional, as it always was. The Infiltration Edge half is a plain
    // compendium Active Effect on the item itself and needs no code.
    id: `${GI_JOE_CRB}BOuJREcROMkMjbM1`,
    conditions: ['surprised'],
    isActive: (actor) => !isKnownOutsideEnvironmentOfExpertise(actor),
  },
  {
    // Dig In (Decepticon Directive Raider, Siegemaster Focus, 10th level, p.64): "you're immune
    // to the Prone Condition" - but only WHILE dug in (a toggled stance, see helpers/dig-in.mjs),
    // unlike every other entry in this table which grants immunity unconditionally just for
    // holding the Perk. `isActive` is the one entry-level escape hatch for that difference - every
    // other entry implicitly has no `isActive` and is always considered active.
    id: `${DECEPTICON_DIRECTIVE}9tIkV50YiO3xqxvi`,
    conditions: ['prone'],
    isActive: isDugIn,
  },
  {
    // Bulwark (Tank Focus, 17th level, p.99): "immune to... the Frightened Condition" while
    // planted (see helpers/bulwark.mjs's own doc comment) - same conditional-isActive shape as
    // Dig In's own Prone immunity just above.
    id: `${GI_JOE_CRB}7758n3XWOzhSjdOk`,
    conditions: ['frightened'],
    isActive: isBulwarkActive,
  },
  {
    // Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - see
    // helpers/greased-lightning.mjs's own doc comment. A spell-granted temporary flag, not a
    // permanently-held Perk - uses `checkFn` (an alternate to every other entry's `id` +
    // actorHasPerk shape) to check the actor's own flag directly instead.
    checkFn: isGreasedLightningActive,
    conditions: ['restrained', 'grappled'],
  },
  {
    // Calming Words (Enigma of Combination, Counselor Focus, 3rd level, p.34) - see
    // helpers/calming-words.mjs's own doc comment. Same flag-based checkFn shape as Greased
    // Lightning above - a roll-granted temporary buff, not a permanently-held Perk.
    checkFn: isCalmingWordsBuffActive,
    conditions: ['frightened', 'mesmerized'],
  },
  {
    // Iron Bravado (PR CRB, Black Spectrum Modification, replaces Whatever We Need, p.45): "When
    // you Attack an enemy, you become immune to the Frightened condition until the beginning of
    // your next turn." A temporary, round-scoped immunity rather than an always-on grant like
    // every other entry here - checkFn reads the flag dice.mjs#rollSkill stamps on any Attack
    // (see helpers/iron-bravado.mjs's own doc comment), rather than a plain actorHasPerk + isActive
    // check against current actor state.
    checkFn: isIronBravadoFrightenedImmune,
    conditions: ['frightened'],
  },
];

// Perk -> the Conditions it grants immunity to for the holder AND allies within radiusFeet (an
// aura). getNearbyAllyTokens (helpers/allies.mjs) is the same Disposition-based "ally" proxy
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
