import { placeAoeTemplate } from "./aoe-targeting.mjs";

/**
 * Attack Powers - the Powers that are rolled against a target's Defense and deal damage, rather
 * than just doing something to their own user.
 *
 * These are the Sorcerous Powers printed in Finster's Monster-Magic Cookbook. Every one of them is
 * written in the same shape as a weapon: "Targeting (Sorcery) attack; Range 30ft/60ft (1 Energy
 * damage Blast [5ft radius])" for Arcane Blast, "Culture (Arcane) attack; Range 20ft in all
 * directions (2 Void Damage)" for Aura of Decay, and so on. They are weaponEffects wearing a
 * Power's clothing - an attack Skill, a damage value, a damage type, and for most of them an area.
 *
 * So rather than inventing a second roll-resolution path for Powers, this routes them down the one
 * that already exists: place the area if there is one, then hand the same
 * dice.handleSkillItemRoll() the weaponEffect and spell branches already use. dice.mjs's own
 * per-target Defense comparison (checkEntries) is item-type-agnostic and needs nothing added for
 * this, and helpers/aoe-targeting.mjs already reads shape/radius off whatever item it's given.
 *
 * A Power is treated as an attack purely by declaring a Defense (data/attack-schema.mjs's own
 * defenseType). Everything else - the overwhelming majority of Grid Powers, which buff their own
 * user or reshape the battlefield - is untouched and still falls through to its own bespoke
 * handler in helpers/power-use.mjs.
 */

/**
 * Whether this Power is rolled as an attack at all.
 * @param {Item} item   The Power being activated.
 * @returns {Boolean}
 */
export function isAttackPower(item) {
  return item?.type == 'power' && !!item.system.defenseType && !!item.system.attackSkill;
}

/**
 * Places the Power's area (if it has one) and rolls its attack, mirroring the weaponEffect branch
 * of documents/item.mjs#roll - the same shift/shiftUp/shiftDown/isSpecialized lookup against the
 * attacker's own Skill, and the same handleSkillItemRoll call.
 *
 * Called from helpers/power-use.mjs#onPowerUse, which means the Power's resource cost has already
 * been spent by the time this runs (see sheet-handlers/power-handler.mjs#powerCost). That ordering
 * matches the "a cancelled placement still rolls" behavior the weaponEffect and spell branches
 * already have: an area that legitimately catches nobody still resolves.
 * @param {Actor} actor   The actor activating the Power.
 * @param {Item} item   The Power being activated.
 * @returns {Promise<Boolean>}   True if this Power was handled as an attack.
 */
export async function rollPowerAttack(actor, item) {
  if (!isAttackPower(item)) {
    return false;
  }

  if (item.system.shape) {
    await placeAoeTemplate(actor, item);
  }

  const skill = item.system.attackSkill;
  const actorSkill = actor.system.skills?.[skill];
  if (!actorSkill) {
    return false;
  }

  item._dice.handleSkillItemRoll(
    {
      rollType: 'power',
      shift: actorSkill.shift,
      skill,
      shiftUp: actorSkill.shiftUp,
      shiftDown: actorSkill.shiftDown,
      isSpecialized: actorSkill.isSpecialized,
    },
    actor,
    item,
  );

  return true;
}
