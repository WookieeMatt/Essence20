import { getUses, markUsed } from "../mechanics/resources/scene-clock.mjs";
import { resolveValue } from "./formula.mjs";

/**
 * Use limits for Use and Trigger rules (docs/RULES_ENGINE_PLAN.md §5.4):
 * `limit: {per, max, key?}`.
 *
 *   per   turn | round | scene | encounter | mission | rest
 *   max   a number or formula (default 1)
 *   key   optional - two items naming the same key share one limit (Wing Missile Salvo)
 *
 * Scene, encounter and mission ride the existing Scene Clock (mechanics/resources/scene-clock.mjs), so they
 * work in and out of combat and reset when the GM advances them. Turn and round are stamped with the
 * combat, round and turn, and count as unused outside combat. Rest counts until the sheet's Rest
 * clears it (rules/adapter.mjs).
 */

export const LIMIT_WINDOWS = ['turn', 'round', 'scene', 'encounter', 'mission', 'session', 'rest'];

/**
 * The game session counter - advanced by the Story Points app's New Session (the qualify2 slice keeps
 * it in the essence20.q2SessionEpoch world setting). Read here directly so this file stays light.
 */
export function sessionEpoch() {
  try {
    const value = Number(globalThis.game?.settings?.get?.('essence20', 'q2SessionEpoch'));
    return Number.isFinite(value) && value > 0 ? value : 1;
  } catch (error) {
    return 1;
  }
}

/** The flag a limit is stored under. */
export function limitFlag(key) {
  return `ruleUses.${String(key).replace(/[^\w-]/g, '_')}`;
}

/** Which key a rule's limit counts against. */
export function limitKey(rule, item, index) {
  return rule?.limit?.key || `${item?.id ?? 'x'}-${index}`;
}

function combatStamp(combat) {
  return combat?.started ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

/**
 * How many times this has been used in its window.
 * @param {Actor} actor
 * @param {String} key
 * @param {String} per
 * @param {Object} [combat]   game.combat, for tests.
 * @returns {Number}
 */
export function usesInWindow(actor, key, per, combat = globalThis.game?.combat) {
  const flag = limitFlag(key);
  if (['scene', 'encounter', 'mission'].includes(per)) {
    return getUses(actor, flag, per);
  }

  const record = actor?.getFlag?.('essence20', flag);
  if (!record) {
    return 0;
  }

  if (per == 'rest') {
    return Number(record.count) || 0;
  }

  if (per == 'session') {
    return record.session == sessionEpoch() ? Number(record.count) || 0 : 0;
  }

  const stamp = combatStamp(combat);
  if (!stamp || record.combatId != stamp.combatId || record.round != stamp.round || (per == 'turn' && record.turn != stamp.turn)) {
    return 0;
  }

  return Number(record.count) || 0;
}

/** Uses left under a rule's limit; Infinity when it has none. */
export function usesLeft(actor, rule, item, index) {
  const limit = rule?.limit;
  if (!limit?.per) {
    return Infinity;
  }

  const max = Math.max(0, Math.round(resolveValue(limit.max ?? 1, { actor, item }, 1)));
  return Math.max(0, max - usesInWindow(actor, limitKey(rule, item, index), limit.per));
}

/** Count one use against a rule's limit. */
export async function recordUse(actor, rule, item, index, combat = globalThis.game?.combat) {
  const limit = rule?.limit;
  if (!limit?.per || !actor?.setFlag) {
    return;
  }

  const key = limitKey(rule, item, index);
  const flag = limitFlag(key);
  if (['scene', 'encounter', 'mission'].includes(limit.per)) {
    await markUsed(actor, flag, { window: limit.per });
    return;
  }

  const count = usesInWindow(actor, key, limit.per, combat) + 1;
  const record = limit.per == 'rest' ? { count } : limit.per == 'session' ? { session: sessionEpoch(), count } : { ...combatStamp(combat), count };
  await actor.setFlag('essence20', flag, record);
}

/** The flag paths of every rest-limited use on an actor - the caller deletes them (a ForcedDeletion each). */
export function restClears(actor) {
  const uses = actor?.flags?.essence20?.ruleUses ?? {};
  return Object.entries(uses).filter(([, record]) => record && record.combatId === undefined && record.epoch === undefined && record.session === undefined)
    .map(([key]) => `flags.essence20.ruleUses.${key}`);
}
