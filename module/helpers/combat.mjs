import { actorHasPerk } from "./perks.mjs";
import { isPersonalShieldActive } from "./personal-shield.mjs";

const IMPENETRABLE_SHIELD_ID = "Compendium.essence20.gi_joe_crb.Item.eEUl7OA9yWAk0QD3";

/**
 * Returns the effective numeric value of one of an actor's four Defenses (Toughness, Evasion,
 * Willpower, Cleverness; p.168-169). Player Character/Companion actors compute the final value
 * into system.defenses[type].total (Essence20Actor#_prepareDefenses); every other actor type
 * (NPC, Vehicle, Zord, Megaform) stores it directly as system.defenses[type].value.
 * @param {Actor} actor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getDefenseValue(actor, defenseType) {
  const defense = actor.system.defenses?.[defenseType];
  return defense?.total ?? defense?.value ?? 0;
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
 * @param {Actor} actor
 * @param {Number} damageValue
 * @param {String} damageType
 * @returns {Promise<Number>}   The amount actually applied (0 if Immune), clamped to how much
 *   Health the actor had left when damageType isn't 'stun'.
 */
export async function applyDamage(actor, damageValue, damageType) {
  const isEmpImmuneViaShield = damageType == 'emp' && isPersonalShieldActive(actor)
    && actorHasPerk(actor, IMPENETRABLE_SHIELD_ID);
  const amount = (actor.system.immunities?.[damageType] || isEmpImmuneViaShield) ? 0 : damageValue;

  if (damageType == 'stun') {
    await actor.update({ 'system.stun.value': actor.system.stun.value + amount });
    return amount;
  }

  const previousValue = actor.system.health.value;
  const newValue = Math.max(0, previousValue - amount);
  await actor.update({ 'system.health.value': newValue });

  return previousValue - newValue;
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
 * Builds the ChatMessage.create() data for a resolved attack or vs-Difficulty Skill Test,
 * rendering templates/chat/check-card.hbs with one row per result.
 * @param {Roll} roll   The already-evaluated Roll.
 * @param {Object} options
 * @param {String} options.flavor   The roll's flavor/label text.
 * @param {Array<Object>} options.results   [{name, targetUuid, difficulty, showDifficulty,
 *   success, multiplier, damageValue, damageTypeLabel, damageType}, ...]
 * @param {Object} options.speaker   ChatMessage speaker data.
 * @param {Boolean} options.canCritD2
 * @returns {Promise<Object>}   The data object to pass to ChatMessage.create().
 */
export async function buildCheckChatData(roll, { flavor, results, speaker, canCritD2 }) {
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
    flags: { essence20: { canCritD2 } },
    rollMode: game.settings.get('core', 'rollMode'),
  };
}
