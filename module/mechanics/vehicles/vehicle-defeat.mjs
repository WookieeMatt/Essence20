import { ruleVehicleDefeatDif, ruleVehicleDefeatSpecialized } from "../../rules/plugins/zords/vehicle-defeat-dif.mjs";
import { ruleExplosionSteps } from "../../rules/plugins/zords/explosion-step.mjs";
import { applyDamage } from "../combat/combat.mjs";
import { getAllNearbyTokens } from "../combat/nearby-allies.mjs";
import { E20 } from "../../util/config.mjs";
import { clearWarriorMode } from "../../items/zords/warrior-mode.mjs";
import { registerAfterDamage } from "../item-hooks.mjs";

/**
 * Defeat of a Vehicle (GI Joe CRB, p.214-215) and its Zord-specific exception (Power Rangers CRB,
 * "Recall for Repairs," p.136). Called from chat.mjs's own onApplyDamage the moment a Vehicle or
 * Zord actor's Health genuinely crosses from >0 to 0 (mirroring how Not On My Watch/CBRN Defender
 * already hook that same transition) - see handleVehicleZeroHealthTransition below, this file's
 * one auto-triggered entry point.
 *
 * A vehicle knocked Prone or driven into terrain it can't pass crashes - the OTHER trigger RAW defines, at any Health total, not just 0 - this system
 * has no terrain/collision model and no hook for a Condition being applied to a specific actor for
 * an arbitrary reason, so unlike the 0-Health branch, that trigger isn't auto-detected. crashVehicle
 * is still exported for a GM to invoke directly (e.g. via a macro) the moment they judge a Vehicle
 * has gone Prone or hit an impassable obstacle - the same "flag the mechanic, leave the
 * unenforceable narrative precondition to the GM" idiom this project already applies broadly.
 *
 * RAW's crash damage (1 Blunt per 10 feet of its last move) needs a distance this system doesn't track anywhere (no token-movement-history log) - approximated
 * as a GM-suppliable amount (movementFeetMoved, defaulting to 0 for the fully-automatic 0-Health
 * path, which has no way to know it) rather than trying to derive it live.
 *
 * Similarly, RAW's own per-hardpoint-weapon DIF 14 Brawn test (fail and the weapon is useless)
 * is simplified to the single shared system.crashed flag (already gating this Vehicle's own
 * Movement to 0 via Essence20Actor#_prepareVehicleData) rather than tracking a separate roll per
 * weapon - a GM narrates hardpoint weapons as offline while crashed.
 */

const BRAWN_DIF = 14;
const DISEMBARK_DIF = 13;
const EXPLOSION_SAVE_DIF = 14;

// A lower explosion Brawn DIF (Heavy Water Coolant's 10) is a VehicleDefeat rule on the vehicle's own Upgrade
// (rules/plugins/zords/vehicle-defeat-dif.mjs). Its `specialize: true` (book check 2026-10-06, Operation Cold Iron p.49:
// a vehicle with Brawn ranks is Specialized for that test) rolls the Specialized staircase - every die up to the Skill's,
// the highest kept, as dice.mjs#_getFormula does.

/**
 * Rolls a single actor's own Skill (shift + modifier, no Edge/Snag/Roll-Options-Dialog - this is
 * a background environmental consequence, not a player's own discretionary Skill Test) against a
 * flat Difficulty. Same "d20, plus a bonus die unless already at d20" formula
 * Essence20Actor#getRollData builds for Initiative.
 * @param {Actor} actor
 * @param {String} skillKey
 * @param {Number} dif
 * @param {Boolean} [specialized]   Roll every die up to the Skill's and keep the highest.
 * @returns {Promise<{total: Number, success: Boolean}>}
 */
async function rollSkillTest(actor, skillKey, dif, specialized = false) {
  const skill = actor.system.skills?.[skillKey];
  if (!skill) {
    return { total: 0, success: false };
  }

  const ladder = E20.skillRollableShifts ?? [];
  const staircase = specialized && ladder.includes(skill.shift) ? ladder.slice(0, ladder.indexOf(skill.shift) + 1) : null;
  const formula = skill.shift == 'd20' ? 'd20' : staircase?.length > 1 ? `d20 + {${staircase.join(',')}}kh` : `d20 + ${skill.shift}`;
  const roll = await new Roll(`${formula} + ${skill.modifier ?? 0}`).evaluate();
  return { total: roll.total, success: roll.total >= dif };
}

/**
 * RAW repeatedly offers "Athletics or Acrobatics" for these Skill Tests - resolved as whichever of
 * the two actually rolls higher, the same "use the better of the two Skills" idiom the GI Joe CRB's
 * own vehicle-crew rules already establish for a vehicle with two listed Attack Skills.
 * @param {Actor} actor
 * @param {Number} dif
 * @returns {Promise<{total: Number, success: Boolean}>}
 */
async function rollBetterOfAthleticsOrAcrobatics(actor, dif) {
  const athletics = await rollSkillTest(actor, 'athletics', dif);
  const acrobatics = await rollSkillTest(actor, 'acrobatics', dif);
  return athletics.total >= acrobatics.total ? athletics : acrobatics;
}

/**
 * Emergency Disembark (GI Joe CRB, p.215): each crew member (system.actors) attempts a DIF 13
 * Athletics or Acrobatics Skill Test to leap free - success lands them Prone in an adjacent space
 * and deals 1d2 Blunt damage; RAW's half-the-impact-damage for anyone who stays aboard
 * or fails to get out only applies to ordinary Vehicles (Zords have no such
 * impact damage of their own to halve - see handleZordZeroHealthTransition below), so
 * vehicleCrashDamage defaults to 0 for that case.
 * @param {Actor} vehicleActor
 * @param {Number} vehicleCrashDamage   The Vehicle's own impact damage (1 Blunt per 10ft moved),
 *   or 0 (Zords, or a Vehicle crash with no supplied movement distance).
 */
async function emergencyDisembarkCrew(vehicleActor, vehicleCrashDamage) {
  const crewEntries = Object.values(vehicleActor.system.actors ?? {});
  for (const entry of crewEntries) {
    const crewMember = await fromUuid(entry.uuid);
    if (!crewMember) {
      continue;
    }

    // Roll Cage: "Crew members roll their Emergency Disembark Skill Tests with Edge."
    // Peerless Pilot (both printings): an AutoDisembark rule passes it outright - rules/plugins/zords/zord-timing-hooks.mjs.
    const { ruleAutoDisembark } = await import("../../rules/plugins/zords/zord-timing-hooks.mjs");
    let { success } = ruleAutoDisembark(crewMember, entry, vehicleActor) ? { success: true } : await rollBetterOfAthleticsOrAcrobatics(crewMember, DISEMBARK_DIF);
    if (!success && vehicleActor.system.traits?.rollCage) {
      ({ success } = await rollBetterOfAthleticsOrAcrobatics(crewMember, DISEMBARK_DIF));
    }

    if (success) {
      await crewMember.toggleStatusEffect('prone', { active: true });
      const fallDamage = await new Roll('1d2').evaluate();
      await applyDamage(crewMember, fallDamage.total, 'blunt');
    } else if (vehicleCrashDamage > 0) {
      await applyDamage(crewMember, Math.ceil(vehicleCrashDamage / 2), 'blunt');
    }
  }
}

/**
 * Vehicle Explosions (GI Joe CRB Table 9-4, p.215): Area of Effect and damage scale with the
 * Vehicle's own Size Class in 3 tiers. E20.actorSizes' own ordering (small through titanic) is
 * used to place a Size Class into the right tier rather than hardcoding the exact named sizes RAW
 * printed, so later-book Sizes beyond Towering (Extended III, Titanic - e.g. Scorponok) fall into
 * the same top tier rather than matching nothing.
 * @param {Actor} actor
 * @returns {{radius: Number, formula: String}}
 */
// A bigger explosion die (Anti-Matter Reactor's one step) is an ExplosionStep rule on the vehicle's own Upgrade
// (rules/plugins/zords/explosion-step.mjs).
const DIE_STEPS = ['2d2', '2d4', '2d6', '2d8', '2d10', '2d12'];

function getExplosionProfile(actor) {
  const profile = baseExplosionProfile(actor);
  const steps = ruleExplosionSteps(actor);
  if (steps > 0) {
    profile.formula = DIE_STEPS[Math.min(DIE_STEPS.length - 1, DIE_STEPS.indexOf(profile.formula) + steps)] ?? profile.formula;
  }

  return profile;
}

function baseExplosionProfile(actor) {
  const sizeOrder = Object.keys(E20.actorSizes);
  const sizeIndex = sizeOrder.indexOf(actor.system.size);

  if (sizeIndex >= 0 && sizeIndex < sizeOrder.indexOf('huge')) {
    return { radius: 15, formula: '2d2' };
  }

  if (sizeIndex >= 0 && sizeIndex < sizeOrder.indexOf('extended2')) {
    return { radius: 30, formula: '2d4' };
  }

  return { radius: 45, formula: '2d6' };
}

/**
 * Defeat of a Vehicle's crash effects (GI Joe CRB, p.214) - see this file's own doc comment for
 * what's simplified (per-hardpoint Brawn Tests, movement-distance tracking) and why. No-ops (past
 * a chat note) if the Vehicle is already crashed, matching RAW's own "if it has not crashed
 * already."
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {Number} [options.movementFeetMoved]   Feet the Vehicle moved on its last move before
 *   crashing, GM-supplied (see this file's own doc comment) - 0 if unknown/not moving.
 */
export async function crashVehicle(actor, { movementFeetMoved = 0 } = {}) {
  if (actor.system.crashed) {
    ChatMessage.create({
      content: game.i18n.format('E20.VehicleAlreadyCrashed', { name: actor.name }),
      speaker: ChatMessage.getSpeaker({ actor }),
    });

    return;
  }

  await actor.update({ 'system.crashed': true });

  const movementCrashDamage = Math.floor(movementFeetMoved / 10);
  if (movementCrashDamage > 0) {
    await applyDamage(actor, movementCrashDamage, 'blunt');
  }

  await emergencyDisembarkCrew(actor, movementCrashDamage);

  ChatMessage.create({
    content: game.i18n.format('E20.VehicleCrashed', { name: actor.name }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/**
 * A Vehicle Exploding (GI Joe CRB, p.215): deals Fire damage (Size-scaled, see
 * getExplosionProfile above) to everything - friend and foe alike, hence getAllNearbyTokens rather
 * than an ally/enemy-scoped scan - within range of the Vehicle's own token, each getting a DIF 14
 * Athletics or Acrobatics Skill Test for half damage (rounded up, this project's usual Degree-of-
 * Success rounding).
 * @param {Actor} actor
 */
export async function explodeVehicle(actor) {
  const { radius, formula } = getExplosionProfile(actor);
  const damageRoll = await new Roll(formula).evaluate();

  for (const token of getAllNearbyTokens(actor, radius)) {
    const { success } = await rollBetterOfAthleticsOrAcrobatics(token.actor, EXPLOSION_SAVE_DIF);
    const amount = success ? Math.ceil(damageRoll.total / 2) : damageRoll.total;
    await applyDamage(token.actor, amount, 'fire');
  }

  ChatMessage.create({
    content: game.i18n.format('E20.VehicleExploded', { name: actor.name, damage: damageRoll.total }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/**
 * Recall for Repairs (Power Rangers CRB, p.136): a Zord at 0 Health goes Prone, its crew bail out as
 * in an emergency disembark, and it then lies dormant - no Brawn Test, no crash-impact damage, no
 * explosion; a Zord is explicitly carved out of ordinary Vehicle defeat. The recall itself, and its return at full
 * Health after the scene, is mechanics/vehicles/zord-recall.mjs.
 * @param {Actor} actor
 */
async function handleZordZeroHealthTransition(actor) {
  await actor.toggleStatusEffect('prone', { active: true });
  await emergencyDisembarkCrew(actor, 0);

  // Warrior Mode (PR CRB, Zord Feature, p.140): "...lasts until...the Zord is subject to Recall
  // for Repairs." This IS that moment - see items/zords/warrior-mode.mjs's own doc comment.
  await clearWarriorMode(actor);

  ChatMessage.create({
    content: game.i18n.format('E20.ZordDormant', { name: actor.name }),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

/**
 * Called from chat.mjs#onApplyDamage the moment a Vehicle or Zord's Health genuinely crosses from
 * >0 to 0 (the caller is responsible for that transition check and for excluding Stun damage,
 * which never reduces Health - see combat.mjs#applyDamage's own doc comment). Marks the actor
 * Defeated (this codebase's normal ordinary-damage path never auto-toggles that status itself,
 * unlike its Stun branch) so a later hit doesn't re-trigger this.
 * @param {Actor} actor
 */
export async function handleVehicleZeroHealthTransition(actor) {
  await actor.toggleStatusEffect('defeated', { active: true });

  if (actor.type == 'zord') {
    await handleZordZeroHealthTransition(actor);
    return;
  }

  // Fragile (GI Joe CRB, Vehicle Trait, p.301): "When a Fragile vehicle is defeated, it
  // immediately explodes" - no Brawn Test, unlike every other Vehicle's own chance to crash
  // instead (see dice.mjs's own Ram-vs-Fragile shiftUp for this Trait's other half).
  if (actor.system.traits?.fragile) {
    await explodeVehicle(actor);
    return;
  }

  const brawnDif = ruleVehicleDefeatDif(actor) ?? BRAWN_DIF;
  // Tiger Stripes (Ferocious Fighters p.30): Edge on the Brawn test against exploding at 0 Health.
  // A crew member with Change Its Stripes
  // (p.12) makes any vehicle their unit is assigned count.
  const tigerStripes = actor.system.traits?.tigerStripes || crewHasChangeItsStripes(actor);
  const specialized = ruleVehicleDefeatSpecialized(actor);
  let brawnTest = await rollSkillTest(actor, 'brawn', brawnDif, specialized);
  if (tigerStripes) {
    const second = await rollSkillTest(actor, 'brawn', brawnDif, specialized);
    brawnTest = second.total > brawnTest.total ? second : brawnTest;
  }

  if (brawnTest.success) {
    await crashVehicle(actor);
  } else {
    await explodeVehicle(actor);
  }
}

const CHANGE_ITS_STRIPES = "Compendium.essence20.ferocious_fighters.Item.8tz9aZSqmUntS20H";

function crewHasChangeItsStripes(vehicle) {
  return Object.values(vehicle.system?.actors ?? {}).some(entry => {
    const crew = globalThis.fromUuidSync?.(entry?.uuid);
    return !!crew?.items?.some?.(item => (item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource) == CHANGE_ITS_STRIPES);
  });
}

// Any damage path (the chat card, rule steps, hazards, a Megazord's split): a Vehicle or Zord whose Health genuinely
// drops from above 0 to 0 - never Stun, which doesn't touch Health - is Defeated / goes dormant once.
registerAfterDamage(async (actor, dealt, damageType, ctx) => {
  if (['vehicle', 'zord'].includes(actor?.type) && dealt > 0 && damageType != 'stun'
    && Number(ctx?.previousValue) > 0 && Number(ctx?.newValue) <= 0 && !ctx?.wasAlreadyDefeated) {
    await handleVehicleZeroHealthTransition(actor);
  }
});
