import { actorHasPerk } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { isDugIn } from "./dig-in.mjs";
import { isBulwarkActive } from "./bulwark.mjs";
import { isGreasedLightningActive } from "./greased-lightning.mjs";
import { isCalmingWordsBuffActive } from "./calming-words.mjs";
import { isIronBravadoFrightenedImmune } from "./iron-bravado.mjs";

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
const TF_CRB = "Compendium.essence20.tf_crb.Item.";
const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";
const PR_CRB = "Compendium.essence20.pr_crb.Item.";
const MLP_CRB = "Compendium.essence20.mlp_crb.Item.";
const THROUGH_THE_SHATTERED_GRID = "Compendium.essence20.through_the_shattered_grid.Item.";

// Perk -> the Conditions it grants immunity to, for the holder only. Each entry is a literal
// transcription of a real "you are immune to the X, Y, and Z Conditions" grant - not a guess at
// what a Perk might cover.
const CONDITION_IMMUNITY_PERKS = [
  {
    // Stalk (GI Joe CRB, Predator base, 1st level, p.93): "any time you are in your environment
    // of expertise, you can not be surprised, and gain an Edge on Infiltration Skill Tests."
    // The first Perk to key off the Surprised status, added the same day (helpers/config.mjs) -
    // before it there was no Condition for this clause to name.
    //
    // "In your environment of expertise" is NOT enforced. The Perk does record a chosen
    // environment (perk-handler.mjs's own 'environments' choiceType), but nothing anywhere tracks
    // which environment a scene IS, so the condition is unknowable at runtime - the same
    // unenforceable-qualifier drop as Bits To Spare/Truthseeker/Fear My Name. The Infiltration
    // Edge half is a plain compendium Active Effect on the item itself and needs no code.
    id: `${GI_JOE_CRB}BOuJREcROMkMjbM1`,
    conditions: ['surprised'],
  },
  {
    // Caution (Bodyguard Focus, 17th level, p.110): "you are immune to the Blinded, Deafened,
    // Frightened, Immobilized, Restrained, and Stunned Conditions."
    id: `${GI_JOE_CRB}pJcXVybdqjcWHpJq`,
    conditions: ['blinded', 'deafened', 'frightened', 'immobilized', 'restrained', 'stunned'],
  },
  {
    // Ambush Master (Door-Kicker Focus, 10th level, p.99): "you are also immune to the Blind and
    // Deafened Conditions." (The other half - "one extra attack with a shotgun or submachine gun
    // when you surprise an enemy" - is action economy, not built.)
    id: `${GI_JOE_CRB}UYaPTaAQH5SDXxnz`,
    conditions: ['blinded', 'deafened'],
  },
  {
    // Shape Shifter (Transformers CRB, Triple Changer Focus, 6th level, p.76): "you become immune
    // to Maneuver attacks and the Prone Condition." The Maneuver half is a damageType, not a
    // Condition - handled by this same Perk's own compendium Active Effect
    // (system.immunities.maneuver) instead, which the existing generic damage-immunity check in
    // applyDamage() (helpers/combat.mjs) already reads without any code here.
    id: `${TF_CRB}Um9sT730VGgHPxLh`,
    conditions: ['prone'],
  },
  {
    // Indomitable (Transformers CRB, Wrecker Focus, 17th level, p.92): "you become immune to the
    // Frightened Condition." (The other half - "attempts to Intimidate you suffer a Snag" - is a
    // roll modifier, handled in dice.mjs#_getAutomaticCombatModifiers instead, not a Condition.)
    id: `${TF_CRB}CXnb6i4d7XhkhFNr`,
    conditions: ['frightened'],
  },
  {
    // Keep Your Cool (A Jump Through Time, General Perk, p.53, built 2026-09-12): "You are immune
    // to the Frightened condition." (The other half - "Intimidation attempts against you suffer
    // Snag" - is a roll modifier, handled in dice.mjs#_getAutomaticCombatModifiers, same shape as
    // Indomitable's own identical pair of clauses.)
    id: "Compendium.essence20.jump_through_time.Item.566NsnD5dccg9uVo",
    conditions: ['frightened'],
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
    // Righteous Heart (PR CRB, General Perk, p.98): "you are completely immune to fear-causing
    // effects." The Perk's other clause ("Free action to gain Resistance to one damage type until
    // the end of your next turn") is a toggle + damage-type picker with its own duration tracking
    // - a distinct, larger piece, not built this pass.
    id: `${PR_CRB}mOgEBZIbiaT07eAq`,
    conditions: ['frightened'],
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
    // Get Low (Technorganic Secrets, Slitherer Origin Benefit, p.43): "While in your Alt Mode, you
    // cannot become Prone" - see dice.mjs's own GET_LOW_ID comment for this Perk's other 2 clauses
    // (ranged-Snag, Infiltration shiftUp). Alt-Mode-conditional, same isActive escape hatch Dig
    // In/Bulwark already establish.
    id: "Compendium.essence20.technorganic_secrets.Item.rEoZEFQR2puQxpIW",
    conditions: ['prone'],
    isActive: (actor) => actor.system?.isTransformed === true,
  },
  {
    // Mind of No Mind (Factions in Action Vol. 2, Arashikage General Perk, p.9): "You are immune
    // to the Frightened Condition." (This Perk's other two clauses - +2 Willpower, a once/scene
    // ↑1 Alertness toggle - are already built elsewhere, per its own doc comment in dice.mjs.)
    id: "Compendium.essence20.intercontinental_adventures.Item.edU8dyL3poLU6IuM",
    conditions: ['frightened'],
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
  {
    // Always Alert (Transformers CRB, General Perk, p.108): "you can't be Surprised while
    // conscious." (This Perk's other clause - an Edge on Initiative Skill Tests - is a plain
    // compendium Active Effect on system.skills.initiative.edge and needs no code.) "While
    // conscious" isn't its own isActive escape hatch: an unconscious actor is already covered by
    // the Unconscious Condition's own effects, so nothing extra is needed to make this immunity
    // stop applying then.
    id: `${TF_CRB}6r0sYiTEtGsge6cB`,
    conditions: ['surprised'],
  },
  {
    // True Self (MLP CRB, Spirit of Honesty, 17th level, p.79): "you become immune to effects
    // that try to affect your behavior, like the Mind Blast spell." Not a status-clearing effect
    // (this entry was previously miscategorized against a "clear every active status" gap that
    // doesn't apply here) - a plain ongoing immunity, same shape as every other entry in this
    // table. This codebase's own two behavior-compelling Conditions are Frightened ("cannot move
    // closer toward" the source) and Mesmerized ("view the mesmerizer as a trusted ally, and will
    // not attack them") - the exact same pair Battlefield Titan's own RAW text already names
    // together below, confirming this is the right mapping rather than a guess.
    id: `${MLP_CRB}LtUei3Rd9ygf2dQa`,
    conditions: ['frightened', 'mesmerized'],
  },
  {
    // Power From Loss (Through the Shattered Grid, General Perk, p.115): "You are immune to the
    // Mesmerized Condition." (The +2 Willpower half is a plain compendium Active Effect and needs
    // no code; the "reroll a Skill Test and choose which results to keep" half is a plain
    // system.reroll grant - see the compendium item's own reroll block, keepBetter:true.)
    id: `${THROUGH_THE_SHATTERED_GRID}AbKqzmAMQZsetwY0`,
    conditions: ['mesmerized'],
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
  const grantsSelf = entry => entry.conditions.includes(statusId)
    && (entry.checkFn
      ? entry.checkFn(actor)
      : actorHasPerk(actor, entry.id) && (!entry.isActive || entry.isActive(actor)));
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
