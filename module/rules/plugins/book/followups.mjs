// Book check, follow-ups (docs/rules-batches/book-followups.md): pieces the rulebook readings needed.
import { registerSceneAdvanced, registerTurnStart } from "../../../mechanics/item-hooks.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * - Tag `item:usesItem:<uuid or id>` - the roll is made with that item: the rolled item is it, or belongs to it (a
 *   weapon's attack), or the roll names it as `dataset.markedItemUuid` (a test about it). Deconstructionist's Snag on
 *   "Skill Tests using the equipment" (QGtG p.26), banked with `appliesWhen: ["item:usesItem:{var.picked}"]`.
 * - Alterations an item rule removes take back what they wrote onto the actor: a timed Alteration that runs out (a Beast
 *   Mode Mutation's scene-long one - Cobra Codex p.59) or one deleted along with the item that granted it goes through
 *   sheet-handlers/alteration-handler.mjs#onAlterationDelete first, as deleting it from the sheet does
 *   (`undoAlterations`, called from rules/triggers.mjs#sweepExpired and rules/lifecycle.mjs's grant clean-up).
 * - Round-limited Conditions out of combat: a round is 6 seconds (PR CRB p.179, Time), so timed-status.mjs stamps a
 *   Condition given for N rounds outside a running combat with the same `rounds:N` stamp marks use
 *   (`flags.essence20.oocConditionExpiry` {until, stamp}); `sweepTimedConditions` takes it off once N x 6 seconds of game
 *   time have passed or the scene has ended (rules/expiry.mjs#isExpired), and a combat started meanwhile counts the
 *   rounds still left. Swept at turn starts, scene changes and world-time changes (the active GM's client).
 */

export const OOC_CONDITION_FLAG = 'oocConditionExpiry';

const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
const lookup = uuid => {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
};

/** Whether `item` (a rolled item) is, or belongs to, the item `ref` (uuid or id) names. */
export function usesItem(item, ref, dataset = null) {
  if (!ref) {
    return false;
  }

  const same = doc => !!doc && (doc.uuid == ref || doc.id == ref);
  if (dataset?.markedItemUuid && (dataset.markedItemUuid == ref || same(lookup(dataset.markedItemUuid)))) {
    return true;
  }

  if (!item) {
    return false;
  }

  if (same(item)) {
    return true;
  }

  const parentId = item.flags?.essence20?.parentId;
  const parent = parentId ? (item.parent ?? item.actor)?.items?.get?.(parentId) ?? itemsOf(item.parent ?? item.actor).find(other => other.id == parentId) ?? null : null;
  return same(parent) || (!!parentId && String(ref).split('.').pop() == parentId);
}

registerTag('item:usesItem', (rest, ctx) => usesItem(ctx?.item, rest, ctx?.dataset ?? null));

/**
 * Before items are removed by a rule (expiry, or with the item that granted them): every Alteration among them takes
 * back the Essence / Skill / Movement changes its drop wrote (the sheet's own delete does the same).
 * @param {Actor} actor
 * @param {Array<String>} ids   Item ids about to be deleted.
 * @param {Function} [undo]     (actor, alteration) => Promise - tests.
 */
export async function undoAlterations(actor, ids, undo = null) {
  const alterations = (ids ?? []).map(id => actor?.items?.get?.(id) ?? itemsOf(actor).find(item => item.id == id)).filter(item => item?.type == 'alteration');
  if (!alterations.length) {
    return 0;
  }

  const run = undo ?? (await import("../../../sheet-handlers/alteration-handler.mjs")).onAlterationDelete;
  for (const alteration of alterations) {
    await run(actor, alteration);
  }

  return alterations.length;
}

/**
 * Take off the out-of-combat round-limited Conditions that have run out.
 * @param {Array<Actor>} [actors]   Default: every actor the timed-item sweep looks at.
 * @returns {Promise<Number>}   How many were removed.
 */
export async function sweepTimedConditions(actors = null) {
  const { isExpired } = await import("../../expiry.mjs");
  let list = actors;
  if (!list) {
    const { sweepActors } = await import("../../triggers.mjs");
    list = sweepActors();
  }

  let removed = 0;
  for (const actor of list) {
    const effects = (actor?.effects?.contents ?? (actor?.effects ? [...actor.effects] : []))
      .filter(effect => effect?.flags?.essence20?.[OOC_CONDITION_FLAG] && isExpired(effect.flags.essence20[OOC_CONDITION_FLAG]));
    if (effects.length && actor.isOwner !== false) {
      await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(effect => effect.id));
      removed += effects.length;
    }
  }

  return removed;
}

// One client sweeps: the active GM's (a player's client can't delete an NPC's effects anyway).
const sweeper = () => {
  const gm = globalThis.game?.users?.activeGM;
  return gm ? !!gm.isSelf : true;
};

registerTurnStart(async () => {
  if (sweeper()) {
    await sweepTimedConditions();
  }
});
registerSceneAdvanced(async () => {
  if (sweeper()) {
    await sweepTimedConditions();
  }
});
globalThis.Hooks?.on?.('updateWorldTime', () => {
  if (globalThis.game?.users?.activeGM?.isSelf) {
    sweepTimedConditions();
  }
});
