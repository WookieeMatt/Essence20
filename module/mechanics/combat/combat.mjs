import { runAfterDamage, runDamageModifiers } from "../item-hooks.mjs";
import { isCarried } from "../actions/team-actions.mjs";
import { onOwnerDefeated } from "../companions/companions.mjs";
import { onBondedHit } from "../companions/bonded-partners.mjs";
import { isSealedAboard } from "../vehicles/vehicle-upgrades.mjs";
import { consumeDamageShield } from "../../rules/plugins/combat/damage-shield.mjs";
import { isWisdomOfTheEldersActive } from "../../items/forms/wisdom-of-the-elders.mjs";
import { applyAtAllCostDamage, isAtAllCostActive } from "../../items/defenses/at-all-cost.mjs";
import { E20 } from "../../util/config.mjs";
import { applyEssenceAttack, isEssenceDamageType } from "./essence-attack.mjs";
import { ruleDriverlessEssence } from "../../rules/plugins/zords/driverless-essence.mjs";
import { ruleDamageImmune } from "../../rules/plugins/combat/damage-immunity.mjs";
import { getMegaformParticipants } from "../vehicles/megaform-participants.mjs";
import { deactivateShynessOnDamage } from "../../items/resources/emotional-mastery.mjs";

// (Relic Key's Willpower / Cleverness default while unpiloted is a DriverlessEssence rule on the Feature -
// rules/plugins/zords/driverless-essence.mjs, read in getDefenseValue below.)

// (Zord Sentience's Essence 2 while unpiloted is a DriverlessEssence rule on the Feature too; Impenetrable Shield's EMP
// Immunity and Energy Mastery's Immunity to its Energy Affinity Element are DamageImmunity rules, read below
// (rules/plugins/combat/damage-immunity.mjs); Life Supporting's recharge is a Use rule on the Upgrade.)

// (The Warlords' incoming-damage reductions - Flame, Frost and Stone - are their items' own DamageModifier rules.)

// "Energy" damage: this project's own established equivalence of PR's "Energy" display term with the Element damage-type
// family (see the Element/Energy reclassification pass's own doc comments) - 'element' itself plus its enumerated
// sub-types confirmed by the Weapon Effects and Traits page (Acid/Cold/Electric/Electromagnetic/Fire/Laser/Sonic).
// Poison and Psychic are real, but RAW-distinct, damage types - not part of the Element family - so they're
// deliberately excluded here.
export const ENERGY_DAMAGE_TYPES = new Set(['element', 'acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic']);

// (Hardened Armor's Resistance after a non-Blunt / Sharp hit is a takesDamage Trigger with a grantResistance step on the
// Perk - rules/plugins/combat/grant-resistance.mjs.)

// (Tough Enough's Resistance to a non-attack effect against Toughness is a CardResistance rule, read by chat.mjs's Apply
// Damage; Cruel Warlord's 2 Personal Power on Psychic damage and Supreme Guardian's Eltarian Tech on Energy damage are
// takesDamage Triggers on those Perks.)

/**
 * Finds the actor currently driving the given vehicle/Zord, via its own system.actors crew map
 * ({vehicleRole, uuid, ...} entries, resolved with fromUuidSync - the same shape
 * prepareSystemActors() and vehicle-handler.mjs's own crew-swap logic already read). Shared by
 * getDefenseValue's own driver/pilot Willpower/Cleverness substitution below and dice.mjs's
 * identically-named private method, which now just delegates here.
 * @param {Actor} vehicleActor
 * @returns {Actor|null}   The driver, or null if the vehicle has no assigned driver.
 */
export function getVehicleDriver(vehicleActor) {
  for (const crewMember of Object.values(vehicleActor.system?.actors ?? {})) {
    if (crewMember.vehicleRole == 'driver') {
      const driver = fromUuidSync(crewMember.uuid);
      if (driver) {
        return driver;
      }
    }
  }

  return null;
}

/**
 * Finds the Zord actor a pilot Actor has registered as their own (e.g. Magna Defender's own
 * Torozord, or any Ranger's plain "Zord") - the entry created when a Zord is dropped directly
 * onto a playerCharacter's own sheet (sheet-handlers/drop-handler.mjs's onDropActor, case
 * 'playerCharacter'), stored in the PILOT's own system.actors, not the Zord's. This is the
 * opposite direction from getVehicleDriver/dice.mjs's own _getPilotedVehicle (both of which read
 * the ZORD's crew map to find who's currently SEATED in it) - "owns a Zord" and "is currently
 * piloting a Zord" are different relationships (a Torozord Feature grant should apply to your own
 * Zord any time, not only while you happen to be seated in it during a live combat roll).
 * @param {Actor} pilotActor
 * @returns {Actor|null}   The owned Zord, or null if none is registered.
 */
export function getOwnedZord(pilotActor) {
  for (const entry of Object.values(pilotActor.system?.actors ?? {})) {
    if (entry.type == 'zord') {
      const zord = fromUuidSync(entry.uuid);
      if (zord) {
        return zord;
      }
    }
  }

  return null;
}

/**
 * Returns the effective numeric value of one of an actor's four Defenses (Toughness, Evasion,
 * Willpower, Cleverness; p.168-169). Every actor type computes its own .total the same way now
 * (Essence20Actor#_prepareDefenses runs for all of them), with one RAW-mandated exception: a
 * Vehicle/Zord's Willpower and Cleverness (system.defenses[type].usesDrivers - see templates/
 * machine.mjs#makeDefensesFields's own doc comment) redirect to its current driver/pilot instead
 * of using its own computed value, per GI Joe CRB p.173 / PR CRB p.126's "Vehicle" trait and PR
 * CRB p.136's baseline Zord stat block ("*Use the pilot's Defense"). An A.I.-trait Vehicle is the
 * one exception to the exception - RAW gives it real Smarts/Social Essence Scores and
 * Willpower/Cleverness Defenses of its own, so it's excluded from the redirect and computes
 * normally.
 * @param {Actor} actor
 * @param {String} defenseType
 * @param {Object} [options]
 * @param {Boolean} [options.ignoreArmor]   PR "Driving Strike" (Finster's Monster-Matic Cookbook
 *   p.286): "...ignore a target's bonuses from armor to Defense..." - subtracts the armor (or,
 *   while Morphed, morphed-form) component _prepareDefenses() already folded into .total, read
 *   back out rather than recomputed.
 * @param {Number} [options.ignoreArmorPoints]   Decepticon Directive Raider "Penetrating Aim"
 *   (Siegemaster Focus, 1st level, p.63): "...ignore 1 point of the target's armor Defense
 *   bonus..." - a partial version of ignoreArmor above (a flat point count instead of an
 *   all-or-nothing strip), capped at the actual armor component so it can never go negative.
 *   Ignored if ignoreArmor is also set (that already strips the whole thing).
 * @param {Boolean} [options.ignoreShield]   Screwball (Cobra Codex, Weapon Upgrade, p.97)'s own
 *   Bypassing trait: "Attacks ignore shield bonuses to Defenses" - subtracts the shield component
 *   _prepareDefenses() already folded into .total, same read-back shape as ignoreArmor above.
 *   Note: ignoreArmor is also forced on automatically whenever `actor` itself carries the
 *   'armorStripped' status (Ice Flechettes, dice.mjs's own ICE_FLECHETTES_EFFECT_IDS comment) -
 *   a target-side effect rather than a caller-passed option.
 * @returns {Number}
 */
export function getDefenseValue(actor, defenseType, { ignoreArmor = false, ignoreArmorPoints = 0, ignoreShield = false } = {}) {
  const defense = actor.system.defenses?.[defenseType];

  // Responsive (GI Joe CRB, Vehicle Trait): "The vehicle can use the driver's Evasion against
  // attacks instead of its own." A driver-value substitution like the Willpower/Cleverness
  // usesDrivers redirect just below, but scoped to Evasion specifically and gated on this one
  // Vehicle Trait rather than being universal - only kicks in with an actual driver seated; RAW
  // has nothing to substitute without one, so this falls through to the vehicle's own normal
  // Evasion below when driverless.
  if (defenseType == 'evasion' && actor.type == 'vehicle' && actor.system.traits?.responsive) {
    const driver = getVehicleDriver(actor);
    if (driver) {
      return getDefenseValue(driver, 'evasion', { ignoreArmor, ignoreArmorPoints, ignoreShield });
    }
  }

  if (defense?.usesDrivers && !(actor.type == 'vehicle' && actor.system.traits?.ai)) {
    const driver = getVehicleDriver(actor);
    if (driver) {
      return getDefenseValue(driver, defenseType, { ignoreArmor, ignoreArmorPoints, ignoreShield });
    }

    // DriverlessEssence rules (Relic Key's "a default Smarts and Social of 3 when ... no crew is currently driving"):
    // run through the same base + essence + bonus + armor + shield shape _prepareDefenses() uses (this Defense's own
    // fields are still real and GM-editable even while unpiloted), substituting the rule's Essence for the missing one.
    const driverlessEssence = ruleDriverlessEssence(actor);
    if (driverlessEssence !== null) {
      return (defense.base ?? 0) + driverlessEssence + (defense.bonus ?? 0)
        + (defense.armor ?? 0) + (defense.shield ?? 0);
    }

    // No driver, no DriverlessEssence rule (Relic Key, Zord Sentience): RAW says this effect only affects the vehicle "if
    // it has a driver" - i.e. it doesn't apply at all while driverless, not that it trivially
    // succeeds.
    // This system has no "this Defense can't be targeted at all" concept to enforce that
    // directly, so this returns an effectively-unbeatable value instead of 0, erring toward
    // "the attack has no effect" rather than "the attack trivially crits."
    return Infinity;
  }

  let value = defense?.total ?? defense?.value ?? 0;

  // Ice Flechettes (Finster's Monster-Matic Cookbook, Path of Frost, 9th level, p.293): "On a
  // Critical Success, the target loses all Defense bonuses provided by armor until the end of
  // their next turn." Read live off the target's own 'armorStripped' status (applied via
  // applyTimedCondition, see dice.mjs's own isIceFlechettesAttempt comment) rather than a passed-
  // in option, since this has to apply to every subsequent roll against the target regardless of
  // who's attacking or whether they declared ignoreArmor themselves - same forced-recompute shape
  // as the Drilling Shot/Quantum Cut callers already use, just triggered by the defender's own
  // state instead of the attacker's.
  const hasArmorStripped = !!actor.statuses?.has?.('armorStripped');

  if ((ignoreArmor || hasArmorStripped) && defense?.total !== undefined) {
    value -= (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
  } else if (ignoreArmorPoints > 0 && defense?.total !== undefined) {
    const armorComponent = (actor.system.isMorphed ? defense.morphed : defense.armor) ?? 0;
    value -= Math.min(armorComponent, ignoreArmorPoints);
  }

  if (ignoreShield && defense?.total !== undefined) {
    value -= defense.shield ?? 0;
  }

  return value;
}

/**
 * Applies the Degrees of Success rule (p.169): a result of double the Difficulty applies the
 * numeric effect (Damage, etc.) twice, triple applies it three times, and so on.
 * @param {Number} total   The rolled Skill Test result.
 * @param {Number} difficulty   The Difficulty (a flat DIF or a target's Defense) being tested.
 * @returns {Number}   0 on a miss, otherwise the number of times the effect applies (minimum 1).
 */
export function computeMultiplier(total, difficulty) {
  if (!difficulty || total < difficulty) {
    return 0;
  }

  return Math.max(1, Math.floor(total / difficulty));
}

/**
 * The generic "how strong is this creature" number this system compares across level-vs-level
 * effects (e.g. Just The Facts below, Sudden Death's own Threat-Level compare in chat.mjs) - a
 * PC/Companion's system.level and an NPC/Vehicle's system.threatLevel are treated as the same
 * number line, unlike chat.mjs's own Sudden Death compare (which deliberately only reads
 * threatLevel, since RAW scopes that Perk to NPC targets specifically). NPCs and Vehicles also
 * carry a system.level (a shared template field, 1 by default), so their Threat Level is read
 * first - their level only while no Threat Level is set (0). Falls back to 0 if neither is set.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getEffectiveLevel(actor) {
  const threat = Number(actor?.system?.threatLevel) || 0;
  if (['npc', 'vehicle'].includes(actor?.type) && threat > 0) {
    return threat;
  }

  return actor?.system?.level ?? actor?.system?.threatLevel ?? 0;
}

/**
 * "Skill Ranks" - a number a few General Perks scale off of (Bulked Up Frame, Tactical
 * Gymnastics, both General Hawk's Personnel Files, p.174/177) that isn't tracked as its own field
 * anywhere in this system, but is fully derivable from data already on the actor. The GI Joe CRB's
 * own worked example makes the formula explicit: "if you have Brawn (Endurance) +d6*, you gain a
 * +4 deflective bonus to Toughness because you have 4 Skill Ranks in Brawn (three for Skill Die
 * and one for a Specialization)" - d20 (the untrained baseline) sits 3 rungs above d6 on
 * E20.skillShiftList, and the Specialization itself adds a 4th. Reuses the same
 * skillShiftList.indexOf delta this project's whole shift-substitution family (Cunning Plan, Ever
 * Vigilant, etc.) already computes shift differences with.
 * @param {Actor} actor
 * @param {String} skill   A key into actor.system.skills.
 * @returns {Number}
 */
export function getSkillRanks(actor, skill) {
  const skillData = actor.system.skills[skill];
  if (!skillData) {
    return 0;
  }

  const untrainedIndex = E20.skillShiftList.indexOf('d20');
  const shiftIndex = E20.skillShiftList.indexOf(skillData.shift);
  if (shiftIndex < 0) {
    return 0;
  }

  return Math.max(0, untrainedIndex - shiftIndex) + (skillData.isSpecialized ? 1 : 0);
}

/**
 * Applies damage to an actor, zeroing it out first if the actor is Immune to the given damage
 * type. Resistance does NOT reduce damage here (p.170: "that means that any form of that damage
 * always has a Snag when rolling tests to apply to the creature or object" - the halved-damage
 * clause only covers the no-roll-involved case, which never applies to this system's automated
 * attack/check pipeline, where the Snag is instead applied to the attack roll itself by
 * Dice#_getAutomaticCombatModifiers). Once a Resistant target is actually hit, the damage lands
 * in full. damageType keys are shared between weaponEffect.damageType and
 * actor.resistances/immunities, so this applies uniformly to whatever effect type the attack was
 * defined with.
 *
 * Stun-type damage doesn't reduce Health at all - it instead adds to the separate
 * system.stun.value accumulator (shown on the sheet as "Stun / Health" and reset to 0 on a
 * rest), which is how this system tracks stun buildup rather than a depleting pool. Every other
 * damage type subtracts from system.health.value as normal, floored at 0.
 * Impenetrable Shield (Vanguard base, 18th level, p.109): "immunity to EMP damage" while the
 * shield is active - unlike the Perk's own Resistance-to-everything-else clause (a Snag on the
 * attack roll instead, see dice.mjs's own target-status checks), immunity zeroes damage after a
 * hit, the same as the actor's own permanent system.immunities below, just conditional on the
 * shield being switched on rather than always-on.
 * Item rules' damage shields (rules/plugins/combat/damage-shield.mjs - Elemental Shield's "ignore N Energy damage") are
 * consumed against the incoming amount right after Immunity has already zeroed it if applicable.
 * Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73): once real
 * Energy damage actually lands here, see grantSupremeGuardianTechRegen's own doc comment above for
 * the passive Eltarian Tech Point regen chance this function calls on the way out, alongside
 * Hardened Armor's own Resistance grant.
 * At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25): while active, a
 * non-stun hit's Health loss is diverted to Personal Power loss instead - see
 * applyAtAllCostDamage's own doc comment in items/defenses/at-all-cost.mjs.
 * Dig Deep (every printing): its "ignore 1 damage" is a DamageReduction rule now (consumeMark digDeep), read in
 * runDamageModifiers.
 * @param {Actor} actor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>}   The amount actually applied (0 if Immune), clamped to how much
 *   Health the actor had left when damageType isn't 'stun'.
 */
export async function applyDamage(actor, damageValue, damageType, isCrit = false, { ignoreImmunity = false, source = null, unreducible = false } = {}) {
  // Not On My Watch (Stun branch) and onOwnerDefeated (Health branch) - captured before any of
  // this function's own mutations, the same "read Defeated status once, up front" idiom
  // chat.mjs#onApplyDamage's own wasAlreadyDefeated already uses - both branches below only fire
  // on a genuine NEW transition into Defeated, not on every subsequent hit against
  // an actor who was already at 0 Health (the Stun branch's own newStunValue >= health.value
  // check, in particular, would otherwise re-trigger on literally every later Stun dealt to an
  // already-Defeated actor, since 0 Health makes that comparison trivially true again).
  const wasAlreadyDefeated = !!actor.statuses?.has?.('defeated');

  // Carrier (PR CRB, Zord Feature, p.136): "carried Zords may not be harmed until released"
  // (mechanics/actions/team-actions.mjs).
  if (isCarried(actor)) {
    return 0;
  }

  // Essence damage types take from an Essence score, not Health - none of the Health reductions
  // below apply (mechanics/combat/essence-attack.mjs). The Essence is random for 'any'/'swap' here; the
  // chat card's own button (chat.mjs#onApplyDamage) lets a Science attacker choose instead.
  if (isEssenceDamageType(damageType)) {
    return (await applyEssenceAttack(actor, damageValue, damageType, { ignoreImmunity })).applied;
  }

  // Wisdom of the Elders - Resilient Armor (Through the Shattered Grid, Guardian of Eltar,
  // 9th/18th level, p.72): "Ignore 1 damage per turn" while active - this applies to ANY incoming
  // damage type, and unlike Elemental Shield's own one-shot "next attack" bank, it's a live toggle applying to
  // every hit for as long as it's switched on (RAW's own "per turn" phrasing is approximated as
  // "per hit while active" - this codebase has no per-turn-reset bucket to track a once-per-turn
  // use separately from the toggle itself, the same "closest existing mechanism" idiom already
  // used throughout this project for a duration this system can't literally enforce).
  // unreducible: damage that "can't be reduced in any way" (Better You Than Me's Void damage - the rules step
  // unreducibleDamage, rules/plugins/book/effects.mjs) skips every reduction, Immunity and damage shield below.
  if (!unreducible && isWisdomOfTheEldersActive(actor, 'resilientArmor')) {
    damageValue = Math.max(0, damageValue - 1);
  }

  // Pressurized Cabin / Submarine Mode: "The sealed compartment grants immunity to Poison and
  // Disease" to everyone aboard (mechanics/vehicles/vehicle-upgrades.mjs).
  const sealedFromPoison = damageType == 'poison' && isSealedAboard(actor);
  let amount = (!ignoreImmunity && !unreducible && (actor.system.immunities?.[damageType] || ruleDamageImmune(actor, damageType) || sealedFromPoison)) ? 0 : damageValue;
  // Extensions (mechanics/item-hooks.mjs) - Protomatter Injection Layer's DamageReduction rule among them.
  if (!unreducible) {
    amount = await runDamageModifiers(actor, amount, damageType, { isCrit, ignoreImmunity });
    amount = await consumeDamageShield(actor, damageType, amount);
  }

  if (damageType == 'stun') {
    const newStunValue = actor.system.stun.value + amount;
    await actor.update({ 'system.stun.value': newStunValue });

    // Item rules' takesDamage Triggers see Stun hits too (the after-damage hooks below are Health only).
    if (amount > 0) {
      const { fireTriggers } = await import("../../rules/triggers.mjs");
      await fireTriggers(actor, 'takesDamage', { damage: { amount, damageType }, roll: { damageType, damageAmount: amount } });
    }

    // Stun (damage type): "the target is denied a Move action for the listed number of turns" -
    // unlike the Defeated toggle below, this one IS accurately turned back off once it should be
    // (see healStunAtTurnStart's own comment), since Stun's own value literally counts down the
    // remaining denied turns - there's no separate duration to lose track of here, just this same
    // number. Uses the existing 'cantTakeMoveActions' status (defined in E20.statusEffects but,
    // like most Conditions in this system, otherwise unenforced anywhere in code) as a visible
    // marker for the GM/player to act on - this system has no per-turn action-economy tracking to
    // actually BLOCK a Move action with (a separate, larger, deliberately deferred gap).
    if (amount > 0) {
      await actor.toggleStatusEffect('cantTakeMoveActions', { active: true });
    }

    // Stun (damage type): "if a creature suffers an amount of total Stun equal to the amount of
    // Health the creature has left, they fall unconscious, Defeated." Compared against the
    // actor's own current Health (Stun never reduces Health itself, see the accumulator comment
    // above) right after the new total lands. Toggled ON only - same "grant, don't auto-revoke"
    // idiom this system already applies to every other status a Perk applies (Lock Down's
    // Immobilized, Stunning Surprise's own Stun, etc.) - a GM clears Defeated manually, same as
    // ever other case. Skipped entirely when no Stun actually landed (Immune, or a 0-value hit),
    // so an already-Defeated actor doesn't get a redundant toggle call on every later Stun.
    if (amount > 0 && newStunValue >= actor.system.health.value) {
      await actor.toggleStatusEffect('defeated', { active: true });

      if (!wasAlreadyDefeated) {
        // Not On My Watch: its item's droppedToZero Trigger only hears Health reaching 0, and a Stun Defeat leaves
        // Health alone - its second watch Trigger hears this defeatedByStun event (rules/plugins/book/effects.mjs).
        const { defeatedByStun } = await import("../../rules/plugins/book/effects.mjs");
        await defeatedByStun(actor);
        // The dealer's defeatedEnemyStun Triggers (rules/plugins/combat/stun-defeat-event.mjs - CBRN Defender).
        const { stunDefeated } = await import("../../rules/plugins/combat/stun-defeat-event.mjs");
        await stunDefeated(actor, source);
      }
    }

    if (amount > 0) {
      await deactivateShynessOnDamage(actor);
    }

    return amount;
  }

  // At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25) - see
  // items/defenses/at-all-cost.mjs's own doc comment. While active, this actor's Health never actually
  // drops - the damage converts to Personal Power loss instead, so Hardened Armor/Supreme
  // Guardian's own hit-triggered grants (both keyed on Health actually dropping) are skipped for
  // this branch entirely, same as they already are for an Immune (0-amount) hit.
  if (isAtAllCostActive(actor)) {
    return await applyAtAllCostDamage(actor, amount);
  }

  const previousValue = actor.system.health.value;
  let newValue = Math.max(0, previousValue - amount);

  // Item rules' wouldBeDefeated Triggers (rules/triggers.mjs) - first in the Defeat-save chain, once
  // every reduction above has landed.
  if (newValue <= 0 && amount > 0) {
    const { wouldBeDefeated } = await import("../../rules/triggers.mjs");
    newValue = Math.max(0, previousValue - await wouldBeDefeated(actor, amount, damageType, { isCrit }));
  }

  // wouldBeDefeated Triggers at stage beforeAegis (rules/plugins/combat/defeat-stage.mjs), in their priority order:
  // Immortal Rebel Soul, Life Supporting, Not Done Yet (on the Renegade the hit's Perks belong to - Racer Abandon's
  // vehicle through scope renegadeVehicle).
  if (newValue <= 0 && amount > 0) {
    const { wouldBeDefeated } = await import("../../rules/triggers.mjs");
    newValue = Math.max(0, previousValue - await wouldBeDefeated(actor, amount, damageType, { isCrit, stage: 'beforeAegis' }));
  }

  // wouldBeDefeated Triggers at stage aegis (rules/plugins/resources/role-points-events.mjs): Aegis keeps the Reckless
  // Abandon holder at 1 Health and marks it.
  if (newValue <= 0 && amount > 0) {
    const { wouldBeDefeated } = await import("../../rules/triggers.mjs");
    newValue = Math.max(0, previousValue - await wouldBeDefeated(actor, amount, damageType, { isCrit, stage: 'aegis' }));
  }

  // wouldBeDefeated Triggers at stage last - checked LAST in this whole chain deliberately: a teammate's resource
  // (We are the Coinless's Personal Power, an aura Trigger on the teammate) is only ever spent once the victim has no
  // self-rescue of their own left.
  if (newValue <= 0 && amount > 0) {
    const { wouldBeDefeated } = await import("../../rules/triggers.mjs");
    newValue = Math.max(0, previousValue - await wouldBeDefeated(actor, amount, damageType, { isCrit, stage: 'last' }));
  }

  await actor.update({ 'system.health.value': newValue });

  // (Not On My Watch's Health-to-0 offer is its item's droppedToZero watch Trigger - not called from here.)
  if (newValue <= 0 && !wasAlreadyDefeated) {
    // Emergency Deployment and Docking - docked Mini-Cons deploy (mechanics/companions/companions.mjs).
    await onOwnerDefeated(actor);
  }

  // Powermaster: "If you are hit by Energy or Laser damage, the module regains 1 Energon Point"
  // (mechanics/companions/bonded-partners.mjs).
  if (amount > 0) {
    await onBondedHit(actor, damageType);
  }

  // source: who dealt it (the chat card's speaker), for their dealtDamage / defeatedEnemy Triggers.
  await runAfterDamage(actor, previousValue - newValue, damageType, { newValue, previousValue, wasAlreadyDefeated, source });

  if (previousValue - newValue > 0) {
    await deactivateShynessOnDamage(actor);
  }

  return previousValue - newValue;
}

/**
 * Stun (damage type): "Stun effects heal 1 per turn." Called from essence20.mjs's own
 * combatTurn/combatRound hooks for whoever's turn is currently starting - "per turn" is read as
 * the Stunned creature's OWN turn (the same turn its accumulated Stun would otherwise be denying
 * a Move action on), not once per round for everyone. A no-op for an actor already at 0 Stun, so
 * this is safe to call unconditionally for the active combatant every turn. Clears the
 * 'cantTakeMoveActions' marker applyDamage's own Stun branch sets once Stun actually reaches 0 -
 * the one Condition in this system whose real duration IS tracked (by the Stun value itself), so
 * unlike Defeated/Immobilized/etc. this one is safe to auto-clear rather than leaving it to a GM.
 * Still doesn't enforce the Move-action denial itself - this system has no action-economy tracking
 * at all (a documented, separate, larger gap) - only marks and un-marks it.
 *
 * A Megaform's own system.stun.value is a live-computed mirror summed fresh from its linked
 * participants every render (Essence20Actor#_prepareMegaformData), the same "not a real pool"
 * treatment its Health gets (see mechanics/vehicles/megaform-damage.mjs's own doc comment) - writing to it
 * directly here would just get overwritten on the Megaform's own next render, silently
 * no-op'ing the heal. Redirected to heal each linked participant's own Stun by 1 instead (the
 * same participants mechanics/vehicles/megaform-damage.mjs's applyMegaformDamage distributes damage
 * across), rather than splitting a single point of healing across them the way damage is split -
 * each participant heals the same 1 per turn it would if it weren't merged.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function healStunAtTurnStart(actor) {
  if (actor?.type == 'megaform') {
    for (const participant of getMegaformParticipants(actor)) {
      await healStunAtTurnStart(participant);
    }

    return;
  }

  const currentStun = actor?.system?.stun?.value ?? 0;
  if (currentStun <= 0) {
    return;
  }

  const newStunValue = currentStun - 1;
  await actor.update({ 'system.stun.value': newStunValue });

  if (newStunValue <= 0) {
    await actor.toggleStatusEffect('cantTakeMoveActions', { active: false });
  }
}

/**
 * Determines whether a roll was a Critical Success and/or a Fumble (p.205): a natural '1' on
 * the d20 portion is always a Fumble; showing the highest face value on any non-d20, non-d2
 * bonus die (d2 only counts if canCritD2, e.g. from an Edge Perk) is a Critical Success.
 * @param {Array<Object>} dice   Roll#dice - one entry per die pool (e.g. d20, 3d6).
 * @param {Boolean} canCritD2   Whether a shift-2 (d2) result counts as a Critical Success.
 * @returns {[Boolean, Boolean]}   [isCrit, isFumble]
 */
export const _isCritIsFumble = function (dice, canCritD2) {
  let isCrit = false;
  let isFumble = false;

  for (let diePool of dice) {
    // A diePool here is a group of similarly-sided dice, such as d20 or 3d6
    let faces = diePool.faces;

    for (let dieValue of diePool.values) {
      // dieValue is an individual result from the diePool
      if (faces === 20 && dieValue === 1) {
        isFumble = true;
      } else if ((faces > 2 || canCritD2) && faces != 20 && dieValue === faces) {
        isCrit = true;
        break; // Only one die needs to crit
      }
    }

    if (isCrit) {
      break; // Perpetuating inner-for break
    }
  }

  return [isCrit, isFumble];
};

/**
 * The second damage component a weaponEffect deals on the same hit (weapon-effect.mjs's
 * secondaryDamage, e.g. "1 Blunt and 1 Stun"), or null when it has none.
 * @param {Item} item   The rolled item (anything other than a weaponEffect has none).
 * @param {Boolean} [forgone]   A Perk traded this attack's damage away (Guardian Strikes etc.).
 * @returns {Object|null}   {type, value}
 */
export function getSecondaryDamage(item, forgone = false) {
  const secondary = item?.type == 'weaponEffect' ? item.system.secondaryDamage : null;
  if (forgone || !secondary?.type || !(secondary.value > 0)) {
    return null;
  }

  return { type: secondary.type, value: secondary.value };
}

/**
 * The secondary damage the Apply Damage button `key` should also deal to `targetUuid`, read off
 * the message's own checkResults (dice.mjs stashes each hit's rider there, since check-card.hbs
 * has no slot for a second damage type). The base button deals the scaled rider; the Critical
 * Success "repeat the effect" option deals it again at its flat value, like the rest of that list.
 * @param {Object} flags   The message's essence20 flags.
 * @param {String} key   The button's own data-key ("<uuid>:base", "<uuid>:crit:double", ...).
 * @param {String} targetUuid
 * @returns {Object|null}   {type, value}
 */
export function getSecondaryDamageForButton(flags, key, targetUuid) {
  const secondary = flags?.checkResults?.find(entry => entry.targetUuid == targetUuid)?.secondaryDamage;
  if (!secondary?.type) {
    return null;
  }

  if (key == `${targetUuid}:base`) {
    return { type: secondary.type, value: secondary.value };
  }

  if (key == `${targetUuid}:crit:double`) {
    return { type: secondary.type, value: secondary.base };
  }

  return null;
}

/**
 * Builds the ChatMessage.create() data for a resolved attack or vs-Difficulty Skill Test,
 * rendering templates/chat/check-card.hbs with one row per result.
 * @param {Roll} roll   The already-evaluated Roll.
 * @param {Object} options
 * @param {String} options.flavor   The roll's flavor/label text.
 * @param {Array<Object>} options.results   [{name, targetUuid, difficulty, showDifficulty,
 *   success, multiplier, damageValue, damageTypeLabel, damageType}, ...]
 * @param {Object} options.speaker   ChatMessage speaker data.
 * @param {Boolean} options.canCritD2
 * @param {Object} [options.rollContext]   {skill, essence, snag} describing what was rolled -
 *   stashed onto the message's flags so a reroll grant (mechanics/rolls/reroll.mjs) can later check
 *   whether it actually applies to this roll (e.g. "Expertise" only rerolls one named skill,
 *   "Veteran" requires the roll wasn't already Snagged).
 * @returns {Promise<Object>}   The data object to pass to ChatMessage.create().
 */
export async function buildCheckChatData(roll, { flavor, results, speaker, canCritD2, rollContext = {} }) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/essence20/templates/chat/check-card.hbs",
    {
      flavor,
      results,
      rollHTML: await roll.render(),
    },
  );

  return {
    content,
    rolls: [roll],
    speaker,
    flags: { essence20: { canCritD2, ...rollContext } },
    rollMode: game.settings.get('core', 'rollMode'),
  };
}
