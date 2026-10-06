import { registerAfterDamage, registerTurnStart } from "../../mechanics/item-hooks.mjs";
import { G2, T, hasItem, itemsOf, post, roundStamp, sourceOf } from "../shared/gij-crb-item-lookups.mjs";

/**
 * Reckless Abandon (GI JOE CRB, Renegade, p.96): "You cannot use kits while fighting with Reckless
 * Abandon. Your Reckless Abandon lasts for a minute, until there are no enemies you can see, or until
 * you are defeated. You can also end your Reckless Abandon as a Free action."
 *
 * The ↑2 Strength and Bonus Health ride the Role Points item's Active toggle already
 * (items/rolls/reckless-abandon.mjs). This ends it: after a minute (10 rounds, the codebase's minute), at
 * the start of the Renegade's turn when no enemy token is left on the scene, and on being Defeated
 * (not for an Aegis holder, whose Aegis keeps them up while it lasts). kitsBlockedFor is read by
 * mechanics/resources/kits.mjs#runKitUse (integration patch) to refuse a kit's Use button.
 */

export const START_FLAG = 'gij2RecklessStart';
export const ROUNDS = 10;

// The Beat Goes On (GI JOE CRB, Renegade Focus, 13th level, p.97): "your Reckless Abandon
// lasts until the end of its duration or until you choose to end it" - so neither running out of
// enemies nor being Defeated ends it for its holder.
export const BEAT_GOES_ON = "Compendium.essence20.gi_joe_crb.Item.yNHekVUMoKALrAWH";

export function recklessItem(actor) {
  return itemsOf(actor).find(item => item.type == 'rolePoints' && sourceOf(item) == G2.recklessAbandon) ?? null;
}

export function isReckless(actor) {
  return !!recklessItem(actor)?.system?.isActive;
}

/** "You cannot use kits while fighting with Reckless Abandon." */
export function kitsBlockedFor(actor) {
  if (!isReckless(actor)) {
    return false;
  }

  ui.notifications?.warn?.(T('E20.Gij2RecklessNoKits', { name: actor.name }));
  return true;
}

globalThis.Hooks?.on?.('updateItem', async (item, changes, options, userId) => {
  if (userId != game.user?.id || item?.type != 'rolePoints' || sourceOf(item) != G2.recklessAbandon || !item.parent) {
    return;
  }

  if (changes?.system?.isActive === true) {
    await item.parent.setFlag('essence20', START_FLAG, roundStamp());
  } else if (changes?.system?.isActive === false && item.parent.flags?.essence20?.[START_FLAG]) {
    await item.parent.unsetFlag('essence20', START_FLAG);
  }
});

export async function endReckless(actor, key) {
  const item = recklessItem(actor);
  if (!item?.system?.isActive) {
    return false;
  }

  const { applyAegisDefeatCheck } = await import("../rolls/reckless-abandon.mjs");
  await applyAegisDefeatCheck(actor);
  await item.update({ 'system.isActive': false });
  await post(actor, T(key, { name: actor.name, perk: item.name }));
  return true;
}

export function minuteIsUp(actor, combat = game.combat) {
  const start = actor?.flags?.essence20?.[START_FLAG];
  return !!start && !!combat && start.combatId == combat.id && start.round != null && combat.round >= start.round + ROUNDS;
}

/** An enemy token still standing on the scene - "no enemies you can see", read as none on the map. */
export function enemiesRemain(actor) {
  const mine = actor?.getActiveTokens?.()?.[0];
  if (!mine || !canvas?.tokens) {
    return true;
  }

  const hostile = -1 * (mine.document.disposition || 0);
  return canvas.tokens.placeables.some(token => token !== mine && token.actor && !token.document.hidden
    && (hostile ? token.document.disposition == hostile : token.document.disposition != mine.document.disposition)
    && !token.actor.statuses?.has?.('defeated'));
}

registerTurnStart(async (actor, combat) => {
  if (!isReckless(actor)) {
    return;
  }

  if (minuteIsUp(actor, combat)) {
    await endReckless(actor, 'E20.Gij2RecklessMinute');
  } else if (!hasItem(actor, BEAT_GOES_ON) && !enemiesRemain(actor)) {
    await endReckless(actor, 'E20.Gij2RecklessNoEnemies');
  }
});

registerAfterDamage(async (actor, dealt, damageType, ctx) => {
  if (isReckless(actor) && (ctx?.newValue ?? 1) <= 0 && !hasItem(actor, G2.aegis) && !hasItem(actor, BEAT_GOES_ON) && actor.isOwner) {
    await endReckless(actor, 'E20.Gij2RecklessDefeated');
  }
});
