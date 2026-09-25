import { getNearbyAllyTokens } from "./allies.mjs";
import { actorHasPerk, hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";
import { canWriteStoryPoints, hasStoryPointsAvailable, requestStoryPointSpend } from "./story-points.mjs";
import { STAND_BY_ME_ID } from "./stand-by-me.mjs";

/**
 * Golden Guardian (Across the Stars, Gold Ranger, 2nd level, p.53, RAW-verified 2026-09-15): "If
 * an attack hits an adjacent ally, you can spend 1 Personal Power to intercept the attack and
 * take the hit yourself. Golden Guardian cannot change whether the attack hits, misses, inflicts
 * damage, is a Critical Success, or the like; you take all the effects caused by the attack." A
 * 6th interposer candidate, same unconditional-redirect shape as the other five - the "cannot
 * change hit/miss/crit" clause is exactly this mechanism's own existing behavior (the original
 * roll's outcome against the ally stands, only the target of its effects changes). Costs 1
 * Personal Power, a plain actor-tracked resource (unlike Stand By Me's world-scoped Story Points),
 * so its own affordability check is a direct field read with no GM-relay needed - checked
 * alongside the other paid option rather than needing its own lazy-eval treatment.
 *
 * Counterstrike (9th level, p.53): "While Morphed, if you call upon the Golden Guardian Role
 * Perk, you may immediately make a single attack against the foe who attacked your teammate."
 * Grants no stat bonus of its own on that attack (unlike Retribution's own +1 damage/Edge) - the
 * only encodable piece is WHO the foe is, so this auto-targets the original attacker (the same
 * `canvas.tokens.setTargets()` "no click to place" convenience Absolute Menace/Elemental Storm
 * already establish) the moment a Golden Guardian redirect is confirmed, letting the protector's
 * own next attack roll default onto them - action economy itself is unenforced everywhere in this
 * project already, so "immediately" needs no separate gate.
 *
 * Multi-Counter (13th level, p.53): "you can intercept ANY NUMBER of attacks targeting adjacent
 * allies... You may Counterstrike for each strike you intercept." Confirmed to need ZERO
 * additional code: Golden Guardian's own RAW text already carries no "once" cap (repeatable as
 * many times as Personal Power allows), and Counterstrike's own auto-target above already fires
 * on every qualifying redirect, not just a first one - Multi-Counter's own text reads as
 * clarifying a specific scenario (a multi-attacking villain, or one attack hitting several
 * allies), not unlocking a numeric limit that was never coded in the first place.
 */
const GOLDEN_GUARDIAN_ID = "Compendium.essence20.across_the_stars.Item.dSMZ5wMdu0Xq0VzX";
const COUNTERSTRIKE_ID = "Compendium.essence20.across_the_stars.Item.8mRJPvxLFVcf0egf";

/**
 * The project's first "reaction to an attack in flight" mechanism - not a chat-button-after-
 * the-fact reaction (Spite/Suffer's own shape, used when the trigger genuinely can't be known
 * until the roll resolves), but a real interception BEFORE damage lands: this codebase already
 * defers applying a hit's damage to a separate, GM-confirmed click (chat.mjs#onApplyDamage,
 * check-card.hbs's "Apply Damage" button - Just a Graze/Didn't Even Feel It/Hard Corps already
 * use that exact real gap between "the attack hit" and "damage is actually applied" for their own
 * "auto-detect eligibility, human confirms" dialogs). A protector redirecting the hit to
 * themselves fits that same window precisely - reassign onApplyDamage's own `target` to the
 * protector BEFORE any of the target's own passive damage-reduction checks run, so everything
 * downstream (Fortitude, Just a Graze, applyDamage itself, CBRN Defender, Tough Enough, ...)
 * naturally applies against the protector instead, with no separate code path needed.
 *
 * Three G.I. Joe CRB Perks share this shape:
 * - Interpose (Renegade/Tank Focus, 3rd level, p.99): "if an adjacent ally is hit by an attack,
 *   you may intercept the attack and take the hit yourself, regardless of whether the roll to
 *   hit the ally would have hit you." No frequency cap.
 * - Body Shield (Renegade/Bodyguard Focus, 3rd level, p.110): "once per turn, when an adjacent
 *   character is attacked on their Toughness or Evasion defense, you may swap places with them
 *   and take the hit for them, now against your Toughness or Evasion defense instead." The "now
 *   against your own Defense instead" clause would need re-resolving hit-or-miss against a
 *   DIFFERENT actor's Defense after the attack roll (and its damage amount) has already been
 *   finalized - not something to retrofit into this system's damage pipeline. Approximated the
 *   same way Interpose's own identical "regardless of whether it would have hit you" clause
 *   already reads: the already-resolved damage amount transfers unconditionally.
 * - Heroic Sacrifice (Officer/Frontline Leader Focus, 17th level, p.87): "once per turn, when an
 *   ally that you could reach with a Sprint takes damage, you may immediately Sprint to a space
 *   adjacent to that ally without using a Move action. You suffer the Damage instead of the
 *   ally, regardless of whether the roll to hit the ally would have hit you." "Reach with a
 *   Sprint" is approximated as double Ground Movement, this system's own general Sprint-action
 *   rule (the same "closest deterministic approximation" idiom used wherever a Perk references
 *   an action this codebase doesn't itself track the execution of).
 *
 * A same-named but distinct General Perk, Story of the Seasons' own Interpose (p.131, RAW-
 * verified 2026-09-15): "If an ally in combat who is adjacent to you suffers health damage as a
 * result of a physical attack, you can selflessly step in front of the attack and suffer the
 * damage instead. This action requires no test and does not cost an action" - functionally
 * identical to GI Joe's own Interpose (adjacent, no frequency cap, full unconditional redirect),
 * so it's checked as a second interposer id rather than duplicating this whole mechanism for one
 * Perk. Its own narrower "physical attack" qualifier is dropped the same way every other
 * unenforceable narrative qualifier in this project already is (Trick Shot's "with a bow", Sky
 * Warrior's "while fighting in the air") - this codebase has no physical/non-physical damage-type
 * split to key off, and GI Joe's own Interpose (this mechanism's original source) has no such
 * qualifier to begin with.
 *
 * All three redirect the FULL damage amount unconditionally - none of them re-check the
 * protector's own Defense (RAW is explicit that the original roll's outcome against the ally
 * stands); the protector's own Resistances/Immunities to the damage TYPE still apply normally,
 * since the redirected amount is re-run through the ordinary applyDamage() pipeline for the
 * protector, not a raw subtraction.
 *
 * Stand By Me (MLP CRB, Loyalty, 2nd level, p.90, RAW-verified 2026-09-15): "If a friend you're
 * standing next to gets targeted by an effect and you don't, you can spend a Friendship Point to
 * be the target of the effect instead." (This Perk's OTHER clause - a live +1 bonus to a nearby
 * friend's Defenses - is unrelated to this mechanism and lives in helpers/stand-by-me.mjs
 * instead.) Same adjacent-redirect shape as the three above, but the first entry in this table to
 * cost a resource - checked LAST (after the free options), gated on `hasStoryPointsAvailable(1)`
 * (Friendship Points are MLP's own relabel of the shared, world-scoped Story Points pool, per
 * helpers/story-points.mjs's own doc comment) so an unaffordable Stand By Me holder isn't offered
 * a redirect nobody can actually pay for.
 *
 * Impenetrable Armor (G.I. Joe CRB, Mechanized Infantry Focus, 10th level, p.81, RAW-verified
 * 2026-09-15 - this entry was previously miscategorized as needing "an established way to
 * retarget an already-in-flight roll from one actor to another," which this whole file already
 * IS): "While piloting a vehicle, you may redirect attacks targeting you to your vehicle." A
 * genuinely different SHAPE of protector than the other four (self-to-VEHICLE, not ally-to-
 * self) - not found via the ally-token proximity scan every other candidate uses, but via the
 * same crew/pilot-assignment lookup (`actor._dice._getPilotedVehicle(actor, 'driver')`) Heavy
 * Ordnance/Dogfighter/Relic Key already established for "is this actor currently piloting a
 * vehicle." No frequency cap in RAW, so checked first alongside the other free options - this
 * candidate is about the TARGET's own Perk, not a nearby ally's, so it's resolved before the
 * ally-token scan even runs.
 */
const INTERPOSE_ID = "Compendium.essence20.gi_joe_crb.Item.srCQjZFTPhm2bK3D";
const INTERPOSE_SOTS_ID = "Compendium.essence20.story_of_the_seasons.Item.rh3eMOKRxZTkOYSo";
const BODY_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.CBfLvmIWdbLuucts";
const BODY_SHIELD_TURN_FLAG = 'bodyShieldUsedThisTurn';
const HEROIC_SACRIFICE_ID = "Compendium.essence20.gi_joe_crb.Item.GqxgLMadhmPYJgKq";
const HEROIC_SACRIFICE_TURN_FLAG = 'heroicSacrificeUsedThisTurn';
const IMPENETRABLE_ARMOR_ID = "Compendium.essence20.gi_joe_crb.Item.vanN7kRYUhgHew7q";
const ADJACENT_FEET = 5;

/**
 * Finds the first ally eligible to redirect a hit against targetActor to themselves, checked in
 * roughly RAW's own printed order (Interpose, Body Shield, Heroic Sacrifice). Doesn't consume
 * anything - see consumeDamageRedirect below, called only once the human confirms.
 * @param {Actor} targetActor   The actor the hit currently applies to.
 * @returns {{protector: Actor, perkId: String}|null}
 */
export function findEligibleProtector(targetActor) {
  // Impenetrable Armor - see its own comment above. Self-to-vehicle, not ally-to-self, so this
  // is resolved before the ally-token scan below even runs.
  if (actorHasPerk(targetActor, IMPENETRABLE_ARMOR_ID)) {
    const pilotedVehicle = targetActor._dice?._getPilotedVehicle(targetActor, 'driver');
    if (pilotedVehicle) {
      return { protector: pilotedVehicle, perkId: IMPENETRABLE_ARMOR_ID };
    }
  }

  const adjacentAllies = getNearbyAllyTokens(targetActor, ADJACENT_FEET).map(token => token.actor).filter(Boolean);

  const interposer = adjacentAllies.find(ally =>
    actorHasPerk(ally, INTERPOSE_ID) || actorHasPerk(ally, INTERPOSE_SOTS_ID),
  );
  if (interposer) {
    const perkId = actorHasPerk(interposer, INTERPOSE_ID) ? INTERPOSE_ID : INTERPOSE_SOTS_ID;
    return { protector: interposer, perkId };
  }

  const bodyShielder = adjacentAllies.find(ally =>
    actorHasPerk(ally, BODY_SHIELD_ID) && !hasUsedThisTurn(ally, BODY_SHIELD_TURN_FLAG),
  );
  if (bodyShielder) {
    return { protector: bodyShielder, perkId: BODY_SHIELD_ID };
  }

  const distantAllies = getNearbyAllyTokens(targetActor, Infinity).map(token => token.actor).filter(Boolean);
  const sacrificer = distantAllies.find(ally => {
    if (!actorHasPerk(ally, HEROIC_SACRIFICE_ID) || hasUsedThisTurn(ally, HEROIC_SACRIFICE_TURN_FLAG)) {
      return false;
    }

    const sprintReach = (ally.system.movement?.ground?.total ?? 0) * 2;
    return getNearbyAllyTokens(ally, sprintReach).some(token => token.actor === targetActor);
  });

  if (sacrificer) {
    return { protector: sacrificer, perkId: HEROIC_SACRIFICE_ID };
  }

  const goldenGuardian = adjacentAllies.find(ally =>
    actorHasPerk(ally, GOLDEN_GUARDIAN_ID) && (ally.system.powers?.personal?.value ?? 0) >= 1,
  );
  if (goldenGuardian) {
    return { protector: goldenGuardian, perkId: GOLDEN_GUARDIAN_ID };
  }

  // Checked last, and only once an actual Stand By Me holder is adjacent - hasStoryPointsAvailable
  // reads a world Setting that isn't mocked in every test/scene this function runs in, so this
  // stays lazy rather than an unconditional pre-check every other (free) candidate above would
  // then also pay the cost of.
  const standByMeHolder = adjacentAllies.find(ally => actorHasPerk(ally, STAND_BY_ME_ID));
  if (standByMeHolder && hasStoryPointsAvailable(1)) {
    return { protector: standByMeHolder, perkId: STAND_BY_ME_ID };
  }

  return null;
}

/**
 * Marks the once-per-turn flag for whichever Perk actually made a protector eligible (Interpose
 * has none to mark), or spends Stand By Me's own Friendship Point cost/Golden Guardian's own
 * Personal Power cost. Called only after the GM confirms the redirect at Apply Damage time.
 * @param {Actor} protector
 * @param {String} perkId
 * @param {Actor} [attacker]   The original attacker - only needed for Golden Guardian's own
 *   Counterstrike follow-on (see this file's own doc comment).
 */
export async function consumeDamageRedirect(protector, perkId, attacker) {
  if (perkId == BODY_SHIELD_ID) {
    await markUsedThisTurn(protector, BODY_SHIELD_TURN_FLAG);
  } else if (perkId == HEROIC_SACRIFICE_ID) {
    await markUsedThisTurn(protector, HEROIC_SACRIFICE_TURN_FLAG);
  } else if (perkId == GOLDEN_GUARDIAN_ID) {
    await protector.update({ 'system.powers.personal.value': protector.system.powers.personal.value - 1 });

    if (attacker && actorHasPerk(protector, COUNTERSTRIKE_ID)) {
      const attackerToken = attacker.getActiveTokens?.()?.[0];
      if (attackerToken) {
        canvas.tokens.setTargets([attackerToken.id]);
      }
    }
  } else if (perkId == STAND_BY_ME_ID && canWriteStoryPoints()) {
    requestStoryPointSpend(protector, 1);
  }
}
