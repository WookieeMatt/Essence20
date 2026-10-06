import { isExpired, stampFor } from "./expiry.mjs";
import { contextFor, evaluate } from "./predicate.mjs";

/**
 * Banked roll bonuses from rule steps (the `bank` step, rules/steps.mjs) - "your next Might test
 * gains ↑1", "an ally's next attack has Edge". Kept on the actor as flags.essence20.ruleBank, a list
 * of entries, offered as automatic roll sources and used up when a roll takes them.
 *
 * Entry: {id, label, shiftUp, shiftDown, edge, snag, when, uses, until, stamp}, or a Defense bonus
 * {defense: toughness|evasion|willpower|cleverness|any (or a list of them), defenseBonus, persist} - added when the actor is
 * attacked against that Defense (bankedDefense), used up by that attack unless `persist`.
 *   when    tags the roll must match (rules/predicate.mjs), e.g. ["skill:might"]
 *   uses    how many rolls it lasts (default 1)
 *   until   also ends at: any rules/expiry.mjs duration ("endOfTurn", "endOfNextTurn", "rounds:2"...) | null (only when used up)
 */

const FLAG = 'ruleBank';

export { isExpired };

/** The actor's live banked entries. */
export function bankedEntries(actor) {
  const list = actor?.flags?.essence20?.[FLAG];
  return (Array.isArray(list) ? list : []).filter(entry => entry && entry.uses > 0 && !isExpired(entry));
}

/** Bank a bonus on an actor. `write` sends the update through the GM when needed. */
export async function bankRollBonus(actor, data, write = (doc, method, args) => doc[method](...args)) {
  const entry = {
    id: globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12),
    label: data.label ?? '',
    shiftUp: Number(data.shiftUp) || 0,
    shiftDown: Number(data.shiftDown) || 0,
    edge: !!data.edge,
    snag: !!data.snag,
    specialize: !!data.specialize,
    // Added to the attack's own damage bonus (multiplied by Degrees of Success) - dice.mjs.
    damage: Number(data.damage) || 0,
    when: Array.isArray(data.when) ? data.when : [],
    uses: Math.max(1, Number(data.uses) || 1),
    until: data.until ?? null,
    stamp: stampFor(data.until, undefined, data.untilActor ?? actor),
    source: data.source ?? null,
  };
  if (data.defense) {
    Object.assign(entry, { defense: data.defense, defenseBonus: Number(data.defenseBonus) || 0, persist: !!data.persist });
  }

  await write(actor, 'update', [{ [`flags.essence20.${FLAG}`]: [...bankedEntries(actor), entry] }]);
  return entry;
}

/**
 * The banked bonuses that apply to this roll, as roll sources, and what to use up if it's made.
 * @returns {{sources: Array, consumes: Array}}
 */
export function bankedSources(actor, target, roll = {}) {
  const sources = [];
  const consumes = [];
  for (const entry of bankedEntries(actor)) {
    if (entry.defense || evaluate(entry.when, contextFor({ ...roll, self: actor, other: target })) !== true) {
      continue;
    }

    sources.push({
      id: `rulebank-${entry.id}`, label: entry.label, shiftUp: entry.shiftUp, shiftDown: entry.shiftDown, edge: entry.edge, snag: entry.snag,
      ...(entry.damage ? { damage: entry.damage } : {}),
    });
    consumes.push({ ext: 'rulesBank', actorUuid: actor.uuid, entryId: entry.id });
  }

  return { sources, consumes };
}

/** Whether a banked bonus makes this roll Specialized (helpers/extensions.mjs#registerSpecializes). */
export function bankedSpecializes(actor, target, roll = {}) {
  return bankedEntries(actor).some(entry => !entry.defense && entry.specialize && evaluate(entry.when, contextFor({ ...roll, self: actor, other: target })) === true);
}

/**
 * The actor is attacked against this Defense: what its banked Defense bonuses add, each used up by this
 * attack unless it persists. `when` sees the attacker as target:.
 * @returns {Promise<Number>}
 */
export async function bankedDefense(defender, defenseType, attacker = null, write = (doc, method, args) => doc[method](...args)) {
  const entries = bankedEntries(defender);
  const used = entries.filter(entry => entry.defense && [entry.defense].flat().some(defense => defense == 'any' || defense == defenseType)
    && evaluate(entry.when, contextFor({ self: defender, other: attacker, defenseType })) === true);
  if (!used.length) {
    return 0;
  }

  const spent = new Set(used.filter(entry => !entry.persist).map(entry => entry.id));
  if (spent.size) {
    const list = entries.map(entry => (spent.has(entry.id) ? { ...entry, uses: entry.uses - 1 } : entry)).filter(entry => entry.uses > 0);
    await write(defender, 'update', [{ [`flags.essence20.${FLAG}`]: list }]);
  }

  return used.reduce((total, entry) => total + (Number(entry.defenseBonus) || 0), 0);
}

/** A roll took a banked bonus: one use off, gone at zero. */
export async function consumeBanked(consume, load = uuid => globalThis.fromUuid?.(uuid)) {
  const actor = await load(consume?.actorUuid);
  if (!actor) {
    return;
  }

  const list = bankedEntries(actor).map(entry => (entry.id == consume.entryId ? { ...entry, uses: entry.uses - 1 } : entry)).filter(entry => entry.uses > 0);
  await actor.update({ [`flags.essence20.${FLAG}`]: list });
}
