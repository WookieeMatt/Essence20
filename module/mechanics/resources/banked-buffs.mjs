import { pickAllyTargets } from "../combat/nearby-allies.mjs";
import { canUseActionPerk, isActionPerkUse, useActionPerk } from "../actions/action-perks.mjs";
import {
  clearPendingBonus, getPendingBonus, postPerkUseChatCard,
} from "../characters/perks.mjs";
import {
  activateLendAssistance, LEND_ASSISTANCE_PERK_IDS,
} from "../actions/lend-assistance.mjs";
import {
  activateEmotionalMastery, activateTeamSpirit, EMOTIONAL_MASTERY_ID, TEAM_SPIRIT_ID,
} from "../../items/resources/emotional-mastery.mjs";
import { applyNuPogodiCondition, canUseNuPogodiCondition } from "../../items/healing/nu-pogodi.mjs";
import { ENERGY_AFFINITY_ID, onEnergyAffinityUse } from "../../items/attacks/energy-affinity.mjs";

// Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level) - see
// items/attacks/psycho-assault.mjs's own doc comment. A one-shot activation (not a two-way toggle - it
// naturally expires at the end of the turn, nothing to manually switch back off), so dispatched
// directly here like Mark Target above.

// (Trade School is item rules on its Perk - a Use, a marked beforeRoll Trigger, DieSubstitution and RollModifiers:
// rules/conv17-perm.test.js.)

// (Tech Specs and Ground Suppression are Use rules on their Perks - rules/conv16-b.test.js.)

// (Dig In, Bulwark, Grow!, Nemesis, Psychological Sway, Perfect Disguise, Supreme Guardian's Blind, Phantom Focus's Healing
// Light, Expanded Mysticism and Personal Heirloom are Use rules on their items - rules/conv17-split2.test.js.)
// (Growl is a Use rule on the Perk - its success marks the target: mark growl, read by Pack Attack's own Use rule -
// rules/conv16-b.test.js.)

// (Metallikato's Multiple Targets on / off, Rise Again's +5 Defense and Righteous Heart's banked Resistance are Use rules on
// their Perks - rules/conv17-Split1.test.js. Ninja Power's on / off switch is its items/movement/ninja-power-jump.mjs Use.)

// (Timeline Anomaly's Initiative swap is a Use rule on its item - rules/conv10-slD10.test.js.)

// (Eye for Appraisal is a Use rule and a RollModifier on its Perk - rules/conv16-b.test.js.)

// (Powerful Suggestions, Data Bridge - with Think Tank's per-ally borrow - and Misery Loves Company are their Perks' own
// rules - rules/conv16-b.test.js.)

// Nu, Pogodi!'s own condition-removal clause (Factions in Action Vol. 2, Oktober Guard Faction
// Perk, p.68) - see items/healing/nu-pogodi.mjs's own doc comment. No Power cost, once per encounter
// (approximating "once per mission").
const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";

/**
 * "Bank a bonus now, spend it on a Skill Test you haven't rolled yet" Perks - Think On It and
 * Plan of Action share this exact shape (see perks.mjs's own bankPendingBonus/getPendingBonus/
 * clearPendingBonus), but until now nothing on the actor sheet let a player actually trigger
 * one - every other Perk automated in this system either fires off an existing roll/attack
 * automatically, or is a passive always-on check. This file is the one new piece: a "Use"
 * control (wired in essence20.mjs's Handlebars helper + a sheet click listener) for whichever
 * Perks are in the table below, plus the (self or ally) targeting logic for actually banking the
 * bonus once clicked.
 *
 * Alpha Strike (Renegade/Door-Kicker Focus, 3rd level, p.98) was originally scoped alongside
 * these two, but its own text - "you can Alpha Strike IF you are attacking an enemy within your
 * reach or within 20 feet... when you USE Alpha Strike, you gain an Edge..." - ties the choice to
 * the moment of a qualifying attack roll, not a standalone Free/Move action taken independent of
 * one. That's a Roll Options Dialog checkbox (the same shape Quiet as the Grave's own
 * applyDamageDouble toggle already uses), not a sheet "Use" button - a genuinely different UI
 * than the other two, so it's deliberately left out of this file rather than forced into a
 * button click it doesn't fit. Not yet built.
 *
 * Consumption is NOT here - see dice.mjs#_getAutomaticCombatModifiers, which reads these same
 * flagKeys back on the actor's (or the chosen ally's) next roll, the same self-status section
 * Debilitating Strike/Who Dares Wins already use.
 */

// (Distraction, Venom Warlord, Unmovable, Dig In (Cannoneer), Frictionless Movement, Sprinter, Wrestler, Power Boost, Brute
// Force, Lance of Light, Rush the Line, Shadow, Silent Strider, Gravity Optional, Grid Soldier, Wisdom of the Elders,
// Observer, Skier, Heroic Intervention, Honest Assessment and EMT Crash Course are Use rules on their items -
// rules/conv17-split3.test.js.)

// (Danger Sense's Protected-Target Initiative sync is a Use rule on its item - rules/conv10-slD10.test.js.)

// (The banked Perks - Plan of Action, Roll With The Punches, Hard Target, Resilience, I Got You, Stalwart Defense
// (rules/conv15-banked.test.js) and Guidance (rules/conv15-items2.test.js) - are Use rules on their items.)

/**
 * Whether the sheet should show a "Use" control for this Perk item right now - it's one of the
 * table above, and there isn't already an unspent banked bonus from it.
 * @param {Item} item
 * @returns {Boolean}
 */
/**
 * Whether the item has a Use of its own (an action-cost, extension or other registered Use), whether or
 * not it can be used right now. A Power with one is used through it alone - its plain activation would
 * only spend Personal Power, since the Use pays its own cost.
 * @param {Item} item
 * @returns {Boolean}
 */
export function hasItemUse(item) {
  return isActionPerkUse(item);
}

export function canUsePerk(item) {
  const actor = item?.parent;
  if (isActionPerkUse(item)) {
    return canUseActionPerk(item);
  }

  // Despite the name, this (and onPerkUse below) also covers `feature`-type Zord Features, not only `perk`
  // items - the same "Use" control/button this whole registry already renders generically for any item
  // (collapsible-item-container-label-buttons.hbs's own {{#if (canUsePerk item)}} check isn't type-scoped).
  // (Relic Key, the first one, is its Feature's own Use rule now.)
  // 'upgrade' joins them for Force Field (Transformers CRB, Armor Upgrade, p.132) - the first
  // Armor Upgrade in this codebase that grants an active, clickable Power rather than an always-on
  // passive bonus. Upgrades not present in BANKABLE_PERKS/IMMEDIATE_ALLY_PERKS below still fall
  // through to `!bankable`/no-immediate-match and correctly get no button, so widening the type
  // allowlist here can't surface a "Use" control on any other, ordinary Upgrade.
  // 'gear' joins them for Energon Cube/Energon Snack (Decepticon Directive Equipment) - see their
  // own comments above. Same "not in any registry means no button" safety as 'upgrade' above.
  // 'hangUp' joins them for Mode Attachment (now its own Use rule) - the
  // first Hang-Up in this codebase to need a player-configurable choice of its own, same
  // "not in any registry means no button" safety as 'upgrade'/'gear' above.
  if (!actor || !['perk', 'feature', 'upgrade', 'gear', 'hangUp'].includes(item.type)) {
    return false;
  }

  const sourceId = item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

  // Team Player / Bureaucrat - the Lend Assistance action itself has no cost or frequency cap in
  // RAW, so this is unconditionally available (see mechanics/actions/lend-assistance.mjs's own doc comment).
  if (LEND_ASSISTANCE_PERK_IDS.includes(sourceId)) {
    return true;
  }

  if (sourceId == EMOTIONAL_MASTERY_ID) {
    return true;
  }

  if (sourceId == TEAM_SPIRIT_ID) {
    return true;
  }

  // (Patch Up is its Perk's own Use rules - rules/conv15-items1.test.js.)

  if (sourceId == NU_POGODI_ID) {
    return canUseNuPogodiCondition(actor);
  }

  return false;
}

/**
 * Banks whichever bonus the given Perk grants, or applies an immediate-ally effect - called from
 * the sheet's own "Use" click.
 * @param {Item} item   The Perk item being used.
 */
export async function onPerkUse(item) {
  const actor = item?.parent;
  const sourceId = item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
  if (!actor) {
    return;
  }

  // Perks that hand out actions - Motivate, Adrenaline Surge, Ready for Action... See
  // mechanics/actions/action-perks.mjs#ACTION_PERK_USES.
  if (isActionPerkUse(item)) {
    const message = await useActionPerk(item);
    if (message) {
      postPerkUseChatCard(actor, message);
    }

    return;
  }

  if (sourceId == ENERGY_AFFINITY_ID) {
    await onEnergyAffinityUse(actor);
    return;
  }

  // Team Player / Bureaucrat - see mechanics/actions/lend-assistance.mjs's own doc comment. The button takes
  // the whole Lend Assistance action (either half); each Perk's own payoff (Team Player's Story
  // Point, Bureaucrat's added Edge) is applied inside it, only on an assist that actually landed.
  if (LEND_ASSISTANCE_PERK_IDS.includes(sourceId)) {
    const result = await activateLendAssistance(actor);
    if (!result.cancelled) {
      postPerkUseChatCard(actor, result.message);
    }

    return;
  }

  if (sourceId == EMOTIONAL_MASTERY_ID) {
    const activated = await activateEmotionalMastery(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.EmotionalMasteryActivated', { actor: actor.name }));
    }

    return;
  }

  if (sourceId == TEAM_SPIRIT_ID) {
    const activated = await activateTeamSpirit(actor);
    if (activated) {
      postPerkUseChatCard(actor, game.i18n.format('E20.TeamSpiritActivated', { actor: actor.name }));
    }

    return;
  }

  // Environmental Expertise, Read the Land and Adaptation switch the same flag through Use rules on their items now.

  if (sourceId == NU_POGODI_ID) {
    const removed = await applyNuPogodiCondition(actor);
    if (removed) {
      postPerkUseChatCard(actor, game.i18n.format('E20.PerkUsedNotification', { perk: item.name, actor: actor.name }));
    }

    return;
  }

}

/**
 * Shared "banked Defense bonus, granted to whichever actor is the beneficiary" primitive - Force
 * Field/Stalwart Defense/Sword And Board (self-targeted) and Remove & Rebuild/Stronger Together
 * (ally-targeted) all bank through the ordinary bankPendingBonus(actor, flagKey, { defenseAmounts })
 * shape (actor being whichever actor the Perk actually benefits - bankPendingBonus already accepts
 * any actor, so "granted to someone other than the user" needed no new BANKING primitive, only this
 * one shared CONSUMING function plus each Perk's own ally-picker/BANKABLE_PERKS `target: 'ally'`
 * entry, both of which already existed - see Plan of Action/Inspiration/Heart of the Team etc.
 * above). Read (and, if it matches, consumed) at the same dice.mjs site as consumeHardTarget/
 * consumeResilience above - the TARGET's own banked
 * effect applying against someone ELSE's attack roll, not the banking actor's own next one.
 *
 * `defenseAmounts` is a plain { toughness, evasion, willpower, cleverness } map, only some of
 * which need be present (Force Field's own {toughness: 2, evasion: 2}, Remove & Rebuild's
 * {toughness: 1, evasion: 1}) - or an `all` key (Stronger Together's {all: 1}, or its own
 * {all: -1} self-penalty) applying uniformly to every Defense type when no more specific key
 * matches, the same "a Defense of your choice"/"all of their Defenses" shape Rise Again/Stronger
 * Together's own RAW text call for, without hardcoding every key by name.
 * @param {Actor} targetActor   The actor being attacked (not the attacker) - the actor the bonus
 *   was banked ON, whether that's the granter themselves or a chosen ally.
 * @param {String} flagKey   This Perk's own distinct flag name.
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume, or nothing
 *   matches this defenseType).
 */
export async function consumeBankedDefenseBonus(targetActor, flagKey, defenseType) {
  const pending = getPendingBonus(targetActor, flagKey);
  if (!pending?.defenseAmounts) {
    return 0;
  }

  const amount = pending.defenseAmounts[defenseType] ?? pending.defenseAmounts.all ?? 0;
  if (!amount) {
    return 0;
  }

  await clearPendingBonus(targetActor, flagKey);
  return amount;
}

export { pickAllyTargets };
