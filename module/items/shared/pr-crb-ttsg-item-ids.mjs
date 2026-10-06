/**
 * Shared bits for the pr3 extension modules (Power Rangers CRB + Through the Shattered Grid
 * Perks, Hang-Ups, gear and Zord Features). The generic readers come from zord1/common.mjs.
 */
export {
  T, findSourced, flagOf, gainPower, giveEdge, hasItem, isStampLive, itemsOf, personalPower,
  postLine, sourceOf, spendPower, writeActor,
} from "./personal-power-allies.mjs";

import { itemsOf, sourceOf, writeActor } from "./personal-power-allies.mjs";

export const PR_CRB = id => `Compendium.essence20.pr_crb.Item.${id}`;
export const TTSG = id => `Compendium.essence20.through_the_shattered_grid.Item.${id}`;

export const IDS = {
  ninjaPower: PR_CRB('wN5rjEQIJH68rWCd'),
  powerHeal: PR_CRB('eiTUR08GXw03M21m'),
  elementalFury: TTSG('larsGRE5U4ZOVxzw'),
};

/** Whether this item is (a copy of) the given compendium item. Guards undefined == undefined. */
export function isItem(item, uuid) {
  const source = sourceOf(item);
  return !!uuid && !!source && source == uuid;
}

/** A held item, skipping Hang-Ups ignored through Matured. */
export function holding(actor, uuid) {
  return itemsOf(actor).find(item => isItem(item, uuid) && !item.flags?.essence20?.maturedIgnored) ?? null;
}

export const escapeHtml = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Per-turn stamp: this combat, round and turn (null out of combat). */
export function turnStamp() {
  const combat = globalThis.game?.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

export function isThisRound(stamp) {
  const combat = globalThis.game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round;
}

/** Put a Condition on someone, through the GM when this user can't write to them. */
export async function applyStatus(actor, statusId, rounds = null) {
  if (!actor) {
    return;
  }

  const { needsGmRelay } = await import("../../mechanics/world/gm-relay.mjs");
  if (needsGmRelay(actor)) {
    await writeActor(actor, 'toggleStatusEffect', [statusId, { active: true }]);
    return;
  }

  if (rounds) {
    const { applyTimedCondition } = await import("../../mechanics/combat/timed-status.mjs");
    await applyTimedCondition(actor, statusId, rounds);
  } else {
    await actor.toggleStatusEffect(statusId, { active: true });
  }
}
