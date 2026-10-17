import { onPowerUse } from "../../mechanics/characters/power-use.mjs";

/**
 * Nanomite equipment (G.I. Joe, Quartermaster's Guide to Gear, "Nanomite Powers," p.92): gear-granted
 * nanomite powers are usually single-use, leaving the gear inert, though requisitioned gear may
 * carry several uses first.
 *
 * The book prints no such items - it's a rule for the GM's own gear. A gear item links one nanomite
 * Power (drop it on the gear's sheet) and carries a number of uses, 1 by default. Using it from the
 * actor sheet spends a use and runs the Power's effect for the holder; at 0 the gear is inert. The
 * uses never come back on their own - unlike the daily uses of a nanomite power inside a character
 * (mechanics/resources/nanomite-uses.mjs), a Rest doesn't refill equipment.
 */

/**
 * @param {Item} gear
 * @returns {Boolean}   Whether this gear carries a nanomite Power at all.
 */
export function hasGearNanomitePower(gear) {
  return !!gear?.system?.nanomite?.powerUuid;
}

/**
 * The linked nanomite Power's name, for the gear sheet - read synchronously off the compendium index.
 * @param {Item} gear
 * @returns {?String}
 */
export function getGearNanomitePowerName(gear) {
  const uuid = gear?.system?.nanomite?.powerUuid;
  return (uuid && globalThis.fromUuidSync?.(uuid)?.name) || null;
}

/**
 * @param {Item} gear
 * @returns {Number}
 */
export function getGearNanomiteUsesLeft(gear) {
  const nanomite = gear?.system?.nanomite;
  return Math.max(0, (nanomite?.uses ?? 0) - (nanomite?.spent ?? 0));
}

/**
 * @param {Item} gear
 * @returns {Boolean}   Carries a nanomite Power and has used it up.
 */
export function isGearNanomiteInert(gear) {
  return hasGearNanomitePower(gear) && getGearNanomiteUsesLeft(gear) == 0;
}

/**
 * Links a dropped Power to a gear item. Only a nanomite Power fits - a Grid Power spends Personal
 * Power, which a piece of equipment has none of. Stores the compendium source, so an item-granted
 * Power's own effect (mechanics/characters/power-use.mjs, keyed by source) still resolves.
 * @param {Item} gear
 * @param {Item} power
 * @returns {Promise<Boolean>}   Whether it was linked.
 */
export async function setGearNanomitePower(gear, power) {
  if (power?.type != 'power' || power.system?.type != 'nanomite') {
    ui.notifications.warn(game.i18n.localize('E20.NanomiteGearOnlyNanomite'));
    return false;
  }

  const powerUuid = power.flags?.core?.sourceId ?? power._stats?.compendiumSource ?? power?.flags?.essence20?.rulesSource ?? power.uuid;
  await gear.update({ 'system.nanomite.powerUuid': powerUuid, 'system.nanomite.spent': 0 });
  return true;
}

/**
 * Uses the gear's nanomite Power: spends one use, says so in chat, then runs the Power's effect for
 * the holder. Refused once the gear is inert.
 * @param {Actor} actor   Whoever holds the gear.
 * @param {Item} gear
 * @returns {Promise<Boolean>}   Whether the Power was used.
 */
export async function useGearNanomitePower(actor, gear) {
  if (!hasGearNanomitePower(gear)) {
    return false;
  }

  if (isGearNanomiteInert(gear)) {
    ui.notifications.warn(game.i18n.format('E20.NanomiteGearInertWarning', { gear: gear.name }));
    return false;
  }

  const powerUuid = gear.system.nanomite.powerUuid;
  const power = await fromUuid(powerUuid);
  if (!power) {
    ui.notifications.warn(game.i18n.format('E20.NanomiteGearMissingPower', { gear: gear.name }));
    return false;
  }

  const spent = (gear.system.nanomite.spent ?? 0) + 1;
  await gear.update({ 'system.nanomite.spent': spent });
  const left = Math.max(0, (gear.system.nanomite.uses ?? 0) - spent);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: game.i18n.format(left ? 'E20.NanomiteGearUsed' : 'E20.NanomiteGearUsedInert', {
      name: actor?.name ?? '', gear: gear.name, power: power.name, left,
    }),
  });

  await onPowerUse(actor, power, 0, { sourceId: powerUuid });
  return true;
}
