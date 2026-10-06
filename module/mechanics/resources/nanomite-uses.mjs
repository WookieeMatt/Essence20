import { getUses, markUsed } from "./scene-clock.mjs";

/**
 * Nanomite powers (G.I. Joe, Quartermaster's Guide to Gear, "Nanomite Powers," p.92-94): "Unless
 * otherwise noted, nanomite powers within a character may be used twice a day." They cost no Personal
 * Power - unlike the Power Rangers Grid Powers they used to share a type with - and are limited by
 * uses instead.
 *
 * Tracked per power (user ruling, 2026-09-27: each power has its own two uses a day), from the Power's
 * own `usesPer` / `usesInterval: 'perDay'` fields and a `usesSpent` counter. A Rest (the sheet's Rest
 * button) is the new day that gives them back. "Always on" powers (All-Around Vision, Poison Immunity)
 * carry no daily uses at all, so nothing is tracked for them.
 *
 * Reprogrammable (+2 daily uses on each of the character's nanomite powers, per copy, under the
 * per-power ruling) is an ItemModifier rule on the Power: it raises each power's derived usesPer.
 *
 * Nanoflage (Chameleonite Focus): its Mimic power is "not limited to two uses of this Nanomite Power
 * per day, instead regenerating one use per scene" - one use a scene on the Scene Clock instead.
 */

const QGTG = "Compendium.essence20.quartermasters_guide_to_gear.Item.";
export const NANOFLAGE_ID = `${QGTG}22p3l2vFsFZqfOET`;
export const MIMIC_ID = `${QGTG}WI0QTzlWkEusSQqY`;
const NANOFLAGE_MIMIC_FLAG = 'nanoflageMimicUsed';

const sourceIdOf = (item) => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;

/**
 * A Nanoflage holder's Mimic: one use a scene instead of two a day.
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Boolean}
 */
export function isNanoflageMimic(actor, power) {
  return sourceIdOf(power) == MIMIC_ID && !!actor?.items?.some?.(item => sourceIdOf(item) == NANOFLAGE_ID);
}

/**
 * @param {Item} power
 * @returns {Boolean}   Whether this power has a daily use limit to track.
 */
export function tracksDailyUses(power) {
  return power?.system?.usesInterval == 'perDay' && power.system.usesPer > 0;
}

/**
 * The daily uses this power has in all: its (derived) usesPer - Reprogrammable's +2 per copy already in it.
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Number}
 */
export function getDailyUsesMax(actor, power) {
  if (!tracksDailyUses(power)) {
    return 0;
  }

  if (isNanoflageMimic(actor, power)) {
    return 1;
  }

  return power.system.usesPer;
}

/**
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Number}   Uses left today (never below 0).
 */
export function getDailyUsesLeft(actor, power) {
  if (tracksDailyUses(power) && isNanoflageMimic(actor, power)) {
    return Math.max(0, 1 - getUses(actor, NANOFLAGE_MIMIC_FLAG, 'scene'));
  }

  return Math.max(0, getDailyUsesMax(actor, power) - (power.system.usesSpent ?? 0));
}

/**
 * Spends one of the power's daily uses, if it tracks them. Called by power-handler.mjs#powerCost for
 * a nanomite power, before its effect runs.
 * @param {Actor} actor
 * @param {Item} power
 * @returns {Promise<Boolean>}   False when there's no use left - the power doesn't activate.
 */
export async function spendDailyUse(actor, power) {
  if (!tracksDailyUses(power)) {
    return true;
  }

  // A FreeUse rule on the Power (Protection / Reactive: switching the boost back off costs nothing).
  const { ruleUseIsFree } = await import("../../rules/plugins/resources/power-used.mjs");
  if (ruleUseIsFree(actor, power)) {
    return true;
  }

  if (getDailyUsesLeft(actor, power) <= 0) {
    ui.notifications.warn(game.i18n.format('E20.PowerNoUsesLeft', { name: actor?.name ?? '', power: power.name }));
    return false;
  }

  if (isNanoflageMimic(actor, power)) {
    await markUsed(actor, NANOFLAGE_MIMIC_FLAG, { window: 'scene' });
    return true;
  }

  await power.update({ 'system.usesSpent': (power.system.usesSpent ?? 0) + 1 });
  return true;
}

/**
 * A Rest gives back every daily use. Called from the sheet's Rest/Recharge action.
 * @param {Actor} actor
 * @returns {Promise<Number>}   How many powers were reset.
 */
export async function resetDailyPowerUses(actor) {
  const updates = (actor?.items?.filter?.(item => item.type == 'power' && item.system?.usesSpent > 0) ?? [])
    .map(item => ({ _id: item.id, 'system.usesSpent': 0 }));
  if (updates.length) {
    await actor.updateEmbeddedDocuments('Item', updates);
  }

  return updates.length;
}

/**
 * "1/2 today" for the sheet, or "" for a power without a daily limit. Registered as the
 * powerDailyUses Handlebars helper.
 * @param {Item} power
 * @returns {String}
 */
export function formatDailyUses(power) {
  if (!tracksDailyUses(power)) {
    return '';
  }

  const actor = power.parent ?? power.actor;
  const key = isNanoflageMimic(actor, power) && game.i18n.has?.('E20.PowerUsesThisScene') ? 'E20.PowerUsesThisScene' : 'E20.PowerUsesToday';
  return game.i18n.format(key, {
    left: getDailyUsesLeft(actor, power),
    max: getDailyUsesMax(actor, power),
  });
}
