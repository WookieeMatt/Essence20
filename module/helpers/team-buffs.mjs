import { bankPendingBonus, hasUsedThisEncounter, markUsedThisEncounter, postPerkUseChatCard } from "./perks.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { hasStoryPointsAvailable, isGmConnected, requestStoryPointSpend } from "./story-points.mjs";

/**
 * "Once per scene/day, broadcast an immediate effect to every nearby ally" Perks - unlike
 * helpers/banked-buffs.mjs's IMMEDIATE_ALLY_PERKS (which prompts for ONE chosen ally), these three
 * affect every Morphed ally on the scene at once, with no picker. Kept in their own file rather
 * than folded into banked-buffs.mjs since none of them share that file's ally-picker plumbing, but
 * wired through the exact same sheet "Use" button/click (see canUsePerk/onPerkUse in
 * banked-buffs.mjs, which dispatch here first).
 */

const PR_CRB = "Compendium.essence20.pr_crb.Item.";

// One For All (Black Ranger, 11th level, p.34): "Once per day, as a Standard action while
// Morphed, you can spend 3 of your current Personal Power to allow all of your teammates to
// regain 1d2 Personal Power immediately." "Once per day" is approximated as "once per encounter" -
// this codebase has no day/long-rest-scoped gate anywhere, hasUsedThisEncounter is the widest
// window that exists (same approximation precedent as every other "once per X" duration already
// accepted elsewhere). "All of your teammates" is read as every Morphed ally on the current scene,
// same "any ally, no distance check" approximation Plan of Action/Heart of the Team already use.
export const ONE_FOR_ALL_ID = `${PR_CRB}8duLY5PjlpmbNkwK`;
const ONE_FOR_ALL_ENCOUNTER_FLAG = 'oneForAllUsedThisEncounter';

// Power Burst (Blue Ranger, 10th/15th level, p.41): "Once per scene... every Morphed member of
// the Power Ranger team, no matter where they are on the Grid in space and time, [gains] 1d2
// Power" (1d4 at 15th, via the Perk's own advances.currentValue - the die's FACE count, matching
// its advances.type: "die"). No Power cost, unlike One For All.
export const POWER_BURST_ID = `${PR_CRB}XfLsm5inPHekj6rY`;
const POWER_BURST_ENCOUNTER_FLAG = 'powerBurstUsedThisEncounter';

// Shining Leader (White Ranger, 8th level, p.65): "Once per scene, you can spend 1 Personal
// Power and a Standard action while Morphed... For the rest of that round and the following
// round, all of your allies gain Edge on their attack Skill Tests." A 2-round window rather than
// a resource grant - banked directly as a plain actor flag (not through banked-buffs.mjs's
// bankPendingBonus/getPendingBonus, which clear on first read; this needs to keep applying across
// every attack in the window, not just one) - see SHINING_LEADER_EDGE_FLAG's own consumption in
// dice.mjs#_getAutomaticCombatModifiers.
export const SHINING_LEADER_ID = `${PR_CRB}woCTg4Lpk3KpsgtF`;
const SHINING_LEADER_ENCOUNTER_FLAG = 'shiningLeaderUsedThisEncounter';
export const SHINING_LEADER_EDGE_FLAG = 'pendingShiningLeaderEdge';

const BENEATH_THE_HELMET = "Compendium.essence20.beneath_the_helmet.Item.";

// Environmental Assist (Beneath the Helmet, Aqua Ranger, Grid Science II choice, p.42): "By
// spending 1 Personal Power, you and any Power Rangers within 60 feet of you may add 1 to the
// damage of their Attacks until the start of your next turn." Unlike One For All/Power Burst/
// Shining Leader above, this explicitly includes the GRANTER themselves ("you AND any... within
// 60 feet"), not just other allies - see includeSelf below. "Choose the damage type based on
// elements in the immediate environment" isn't tracked - this system's own damageType field is
// per-hit and can't represent "the weapon's normal type, plus 1 point of a different chosen
// type" as a genuine mix (the same "closest single-field approximation" idiom this project's own
// Element/Energy reclassification pass already applied to a mixed-type stat block elsewhere) - so
// this is built as a plain flat +1 damage bonus, the type left unspecified.
export const ENVIRONMENTAL_ASSIST_ID = `${BENEATH_THE_HELMET}5gPWxUEkFKDQf6lM`;
const ENVIRONMENTAL_ASSIST_ENCOUNTER_FLAG = 'environmentalAssistUsedThisEncounter';
export const PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY = 'pendingEnvironmentalAssist';

// Elemental Shield (Beneath the Helmet, Aqua Ranger, 9th/18th level, p.42, replaces Power
// Infusion): "Once per scene... you and each of your Morphed Power Ranger teammates within 60
// feet may ignore 1 Energy damage that they take from their next attack by an energy weapon."
// (2 at 18th, via the Perk's own scaling advances.currentValue - same selectionLimit:2 pattern as
// Precision Aim/Power Boost). Also includes the granter ("you AND each of your... teammates"),
// same as Environmental Assist above. Unlike every other entry here, this is a DEFENSIVE
// damage-REDUCTION grant (consumed against the next hit the target actually TAKES, not their own
// next attack) - see PENDING_ELEMENTAL_SHIELD_FLAG_KEY's own consumption in
// helpers/combat.mjs#applyDamage. "Energy weapon" is this project's own established equivalence
// of PR's "Energy" display term with the Element damage-type family (see the Element/Energy
// reclassification pass) - matched against ENERGY_DAMAGE_TYPES there.
export const ELEMENTAL_SHIELD_ID = `${BENEATH_THE_HELMET}3kcNR23zhInxqKQp`;
const ELEMENTAL_SHIELD_ENCOUNTER_FLAG = 'elementalShieldUsedThisEncounter';
export const PENDING_ELEMENTAL_SHIELD_FLAG_KEY = 'pendingElementalShield';

// Rallying Cry (GI Joe CRB, Tank Focus, 10th level, p.99): "As a Free action, you can shout out a
// rallying cry. When you do so, up to ten allies within 60 feet that can see and hear you gain an
// Edge on attacks until the end of your next turn or until you are Defeated, whichever comes
// first." Same 2-round Edge-window shape as Shining Leader (its own "for the rest of that round
// and the following round" is the identical approximation of "until the end of your next turn"),
// but a distinct flag (RALLYING_CRY_EDGE_FLAG, so its own consumption in dice.mjs doesn't collide
// with Shining Leader's) and radiusFeet:60 (Shining Leader's own "all of your allies" has no
// distance cap). No Power cost (a Free action, not a Standard one). "Up to ten allies" isn't
// capped in code - the same "no hard cap enforced, GM/fiction manages how many are actually in
// range" idiom Stronger Together/Environmental Assist's own "within Xft" grants already accept
// without a headcount limit. The first non-Morphing (GI Joe) entry in this table - see
// requiresMorphed's own doc comment below.
export const RALLYING_CRY_ID = "Compendium.essence20.gi_joe_crb.Item.cBbQVq9ZqcVUpAQs";
export const RALLYING_CRY_EDGE_FLAG = 'pendingRallyingCryEdge';

// Heart Of The Team (GI Joe CRB, Vanguard base, 14th level, p.109) - a DIFFERENT compendium item
// from PR CRB's identically-named Black Ranger Perk (see HEART_OF_THE_TEAM_ID in banked-buffs.mjs,
// already built earlier this project - a single-ally banked shiftUp, unrelated mechanic despite
// the shared name). RAW: "Once per encounter as a Standard action, you spend a Story Point to
// yell out and rally your team. All allies within 30 feet of you may immediately move their full
// Movement, and may either end one Condition or gain one Temporary Health." Only the Temporary
// Health half is built - "immediately move their full Movement" is an action-economy grant (an
// extra free move action) this system has no budget to track, and "end one Condition" needs both
// a per-ally choice UI and a generic "clear any active status" sweep, neither of which exist
// anywhere in this codebase (the same gaps already documented on True Self/Healing Light's own
// unautomated Condition-clearing halves) - flagged, not silently dropped. The first entry in this
// table costing a Story Point instead of Power - see worldStoryPointCost below.
export const HEART_OF_THE_TEAM_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.ME4xFG31XvT6q6Qp";
const HEART_OF_THE_TEAM_GIJ_ENCOUNTER_FLAG = 'heartOfTheTeamGijUsedThisEncounter';

// Nano-Med Mastery (GI Joe CRB, Medic Focus, 18th level, p.82, built 2026-09-12): "Once per
// encounter, as a Standard action, give your allies within a 60 foot area a boost of healing
// nanites. All allies heal 2 damage (recovering from Defeat if necessary), and gain an Edge on
// Attack rolls and Skill Tests until the end of your next turn." The first entry needing a
// combined effect (a real Health heal AND an Edge window at once) - see the new 'healAndEdge'
// branch below, reusing the plain Health-update idiom Whatever Helps/Helping Hand already
// establish (capped at max) alongside the same Edge-flag banking 'edge' above already uses.
// "Recovering from Defeat if necessary" falls out for free - toggleStatusEffect isn't needed since
// a Defeated actor's own Health is already 0, and this just adds to it like any other heal. No
// Personal Power cost in RAW (unlike most of this table); "within 60 feet" includes the granter
// themselves, the same reading Environmental Assist's own "you AND any... within 60 feet" uses.
export const NANO_MED_MASTERY_ID = "Compendium.essence20.gi_joe_crb.Item.7hMe2hYONR6wBMFv";
const NANO_MED_MASTERY_ENCOUNTER_FLAG = 'nanoMedMasteryUsedThisEncounter';
export const NANO_MED_MASTERY_EDGE_FLAG = 'pendingNanoMedMasteryEdge';

// Perk -> { powerCost, worldStoryPointCost, onceEncounterFlag, effect, dieFaces, includeSelf,
// edgeFlagKey, radiusFeet, requiresMorphed, tempHealthAmount }. effect 'power' grants each ally a
// rolled amount of Personal Power (dieFaces null means "read from the Perk's own
// advances.currentValue instead of a fixed table value" - Power Burst's own scaling); effect
// 'edge' bans a 2-round Edge-on-attacks flag instead (which flag - edgeFlagKey - defaults to
// SHINING_LEADER_EDGE_FLAG when unset, for the two PR CRB Perks that already relied on that
// default); effect 'damageBonus' banks a flat +1 damage flag (see
// PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY's own comment above, consumed the same way every other
// flat damage bonus already folds into dice.mjs's own damageBonusValue); effect 'damageReduction'
// banks a scaling "ignore N Energy damage" flag instead, consumed defensively in
// combat.mjs#applyDamage rather than offensively in dice.mjs; effect 'tempHealth' adds a flat,
// immediate system.health.bonus to each target (same field Protected Target's own Temporary
// Health grant already uses - no automatic removal, the same "GM manages the edges" idiom that
// grant already accepts). Environmental Assist and Elemental Shield both set includeSelf - every
// other entry here only ever affects OTHER allies, matching getNearbyAllyTokens' own "excludes the
// actor's own token" default. radiusFeet defaults to Infinity (every existing entry's own "any
// ally on the scene" approximation) when unset. requiresMorphed defaults to true (every existing
// entry here is a Power Ranger Perk gated on Morphed teammates) - Rallying Cry and Heart Of The
// Team are GI Joe entries, with no Morph state to gate on, so they opt out explicitly rather than
// the default silently widening who the 5 PR CRB entries above already affect. worldStoryPointCost
// (an alternative to powerCost, not combined with it by any entry so far) spends a world Story
// Point instead of Personal Power, the same isGmConnected()/hasStoryPointsAvailable() gate
// banked-buffs.mjs's own Bait and Switch/Concentrate Fire dispatches already establish.
const TEAM_BUFF_PERKS = {
  [ONE_FOR_ALL_ID]: { powerCost: 3, onceEncounterFlag: ONE_FOR_ALL_ENCOUNTER_FLAG, effect: 'power', dieFaces: 2 },
  [POWER_BURST_ID]: { powerCost: 0, onceEncounterFlag: POWER_BURST_ENCOUNTER_FLAG, effect: 'power', dieFaces: null },
  [SHINING_LEADER_ID]: { powerCost: 1, onceEncounterFlag: SHINING_LEADER_ENCOUNTER_FLAG, effect: 'edge' },
  // No onceEncounterFlag - unlike the other three entries above, RAW never limits Environmental
  // Assist to once per scene/day, only the Power cost itself.
  [ENVIRONMENTAL_ASSIST_ID]: { powerCost: 1, effect: 'damageBonus', includeSelf: true },
  [ELEMENTAL_SHIELD_ID]: {
    powerCost: 1, onceEncounterFlag: ELEMENTAL_SHIELD_ENCOUNTER_FLAG, effect: 'damageReduction', includeSelf: true,
  },
  [RALLYING_CRY_ID]: {
    powerCost: 0, effect: 'edge', edgeFlagKey: RALLYING_CRY_EDGE_FLAG, radiusFeet: 60, requiresMorphed: false,
  },
  [HEART_OF_THE_TEAM_GIJ_ID]: {
    worldStoryPointCost: 1, onceEncounterFlag: HEART_OF_THE_TEAM_GIJ_ENCOUNTER_FLAG, effect: 'tempHealth',
    tempHealthAmount: 1, radiusFeet: 30, requiresMorphed: false,
  },
  [NANO_MED_MASTERY_ID]: {
    powerCost: 0, onceEncounterFlag: NANO_MED_MASTERY_ENCOUNTER_FLAG, effect: 'healAndEdge',
    healAmount: 2, edgeFlagKey: NANO_MED_MASTERY_EDGE_FLAG, radiusFeet: 60, requiresMorphed: false, includeSelf: true,
  },
};

/**
 * Whether the given Perk item is one of this file's own "broadcast to all allies" table - used by
 * banked-buffs.mjs's canUsePerk/onPerkUse to decide whether to dispatch here.
 * @param {Item} item
 * @returns {Boolean}
 */
export function isTeamBuffPerk(item) {
  const sourceId = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource;
  return !!TEAM_BUFF_PERKS[sourceId];
}

/**
 * Whether the sheet should show a "Use" control for this Perk right now - affordable, and not
 * already used this scene/day.
 * @param {Item} item
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseTeamBuffPerk(item, actor) {
  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
  const config = TEAM_BUFF_PERKS[sourceId];
  if (!config || (config.onceEncounterFlag && hasUsedThisEncounter(actor, config.onceEncounterFlag))) {
    return false;
  }

  if (config.worldStoryPointCost) {
    return isGmConnected() && hasStoryPointsAvailable(config.worldStoryPointCost);
  }

  return actor.system.powers.personal.value >= config.powerCost;
}

/**
 * Applies the Perk's own broadcast effect to every nearby Morphed ally - called from the sheet's
 * own "Use" click, once banked-buffs.mjs#onPerkUse has confirmed this is a team-buff Perk.
 * @param {Item} item
 * @param {Actor} actor
 */
export async function onTeamBuffPerkUse(item, actor) {
  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
  const config = TEAM_BUFF_PERKS[sourceId];
  if (!config) {
    return;
  }

  if (config.powerCost && actor.system.powers.personal.value < config.powerCost) {
    ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
    return;
  }

  if (config.worldStoryPointCost && !isGmConnected()) {
    ui.notifications.warn(game.i18n.localize('E20.SptNoGmConnected'));
    return;
  }

  // requiresMorphed (default true, preserving every existing entry's own behavior below) - the
  // Rallying Cry entry is the first non-Morphing (GI Joe) Perk in this table, so it opts out
  // explicitly rather than this defaulting to false and silently widening who One For All/Power
  // Burst/Shining Leader/Environmental Assist/Elemental Shield already affect.
  const allNearbyAllies = getNearbyAllyTokens(actor, config.radiusFeet ?? Infinity).map(token => token.actor);
  const nearbyAllies = (config.requiresMorphed ?? true) ? allNearbyAllies.filter(a => a?.system.isMorphed) : allNearbyAllies;
  // Environmental Assist is the one entry here that also affects the granter themselves ("you
  // AND any... within 60 feet") - see its own comment on TEAM_BUFF_PERKS above. getNearbyAllyTokens
  // excludes the actor's own token by design, so it's added back in here rather than widened there.
  const targets = config.includeSelf ? [actor, ...nearbyAllies] : nearbyAllies;

  if (config.powerCost) {
    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - config.powerCost });
  }

  if (config.worldStoryPointCost) {
    requestStoryPointSpend(actor, config.worldStoryPointCost);
  }

  if (config.effect == 'power') {
    const dieFaces = config.dieFaces ?? item.system.advances.currentValue;
    for (const target of targets) {
      const roll = await new Roll(`1d${dieFaces}`, target.getRollData()).evaluate();
      await target.update({ 'system.powers.personal.value': target.system.powers.personal.value + roll.total });
    }
  } else if (config.effect == 'edge') {
    for (const target of targets) {
      await target.setFlag('essence20', config.edgeFlagKey ?? SHINING_LEADER_EDGE_FLAG, {
        combatId: game.combat?.id ?? null,
        round: game.combat?.round ?? null,
      });
    }
  } else if (config.effect == 'damageBonus') {
    for (const target of targets) {
      await bankPendingBonus(target, PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY);
    }
  } else if (config.effect == 'damageReduction') {
    const amount = item.system.advances.currentValue;
    for (const target of targets) {
      await bankPendingBonus(target, PENDING_ELEMENTAL_SHIELD_FLAG_KEY, { amount });
    }
  } else if (config.effect == 'tempHealth') {
    for (const target of targets) {
      await target.update({ 'system.health.bonus': (target.system.health.bonus || 0) + config.tempHealthAmount });
    }
  } else if (config.effect == 'healAndEdge') {
    for (const target of targets) {
      await target.update({
        'system.health.value': Math.min(target.system.health.max, target.system.health.value + config.healAmount),
      });
      await target.setFlag('essence20', config.edgeFlagKey, {
        combatId: game.combat?.id ?? null,
        round: game.combat?.round ?? null,
      });
    }
  }

  if (config.onceEncounterFlag) {
    await markUsedThisEncounter(actor, config.onceEncounterFlag);
  }

  const names = targets.map(a => a.name).join(', ') || actor.name;
  postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: names }));
}
