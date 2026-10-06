import { registerSceneAdvanced, registerTurnEnd } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { registerEvent } from "../../types.mjs";
import { escape, say, T, worldActors, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Story Point pieces (round 10, group D):
 *
 *  - The personal Story Point pool: points given to one character that only they can spend (Ruthless Points). Kept on
 *    the actor as flags.essence20.personalPoints; mechanics/resources/story-points.mjs spends them before the table's pool
 *    (personalStoryPoints / spendPersonalStoryPoint). A point lasts until the end of its holder's next turn (one given
 *    during the holder's own turn survives that turn's end too); a shared point is used up for everyone sharing it;
 *    a new scene clears them all.
 *  - Step `givePersonalPoints {to, count, shared?, max?, ownTurn?}` - give points (shared: ONE point every recipient
 *    shares; max: only the first N recipients; ownTurn: count it as given on the recipient's own turn).
 *  - Trigger event `personalPointUnspent` - an actor ended its turn holding personal points: fired on every world actor
 *    with a Trigger for it, the actor that ended its turn as target (`target:self`, `target:sameType`), before the
 *    points run out.
 *  - Trigger event `storyPointNarrative` - the Story Points tracker's narrative spend (apps/story-points.mjs),
 *    @var.kind (equipment, ...).
 *  - Tag `target:sameType` - the other party is the same kind of actor as this one.
 */

export const POINTS_FLAG = 'personalPoints';

export function pointsOf(actor) {
  const list = actor?.flags?.essence20?.[POINTS_FLAG];
  return Array.isArray(list) ? list : [];
}

/** How many personal Story Points the actor can spend right now. */
export function personalStoryPoints(actor) {
  return pointsOf(actor).length;
}

const randomId = () => globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);

/** A new point record: it lives through two of the holder's turn ends when given on their own turn, else one. */
export function newPoint({ onOwnTurn, shareId = null, source = '', label = '' }) {
  return { id: randomId(), source, label, shareId, turnEndsLeft: onOwnTurn ? 2 : 1 };
}

/** The holder's points after one of their turns ends: one fewer turn end each, those at zero gone. */
export function afterTurnEnd(points) {
  const kept = [];
  const expired = [];
  for (const point of points) {
    const next = { ...point, turnEndsLeft: (point.turnEndsLeft ?? 1) - 1 };
    (next.turnEndsLeft > 0 ? kept : expired).push(next);
  }

  return { kept, expired };
}

function isOwnTurn(actor) {
  const current = globalThis.game?.combat?.combatant?.actor;
  return !!current && !!actor && current.uuid == actor.uuid;
}

export async function givePoints(actor, count, options = {}) {
  const added = Array.from({ length: count }, () => newPoint({ onOwnTurn: options.onOwnTurn ?? isOwnTurn(actor), ...options }));
  await write(actor, 'update', [{ [`flags.essence20.${POINTS_FLAG}`]: [...pointsOf(actor), ...added] }]);
  return added;
}

/**
 * Spend the actor's own points in place of the pool (mechanics/resources/story-points.mjs asks first).
 * @returns {Promise<Boolean>}   True if the whole amount came out of personal points.
 */
export async function spendPersonalStoryPoint(actor, amount = 1, announce = true) {
  const points = pointsOf(actor);
  if (!actor || amount < 1 || points.length < amount) {
    return false;
  }

  const spent = points.slice(0, amount);
  await write(actor, 'update', [{ [`flags.essence20.${POINTS_FLAG}`]: points.slice(amount) }]);
  // A shared point is used up for everyone sharing it.
  for (const shareId of spent.map(p => p.shareId).filter(Boolean)) {
    for (const other of worldActors()) {
      if (other.uuid != actor.uuid && pointsOf(other).some(p => p.shareId == shareId)) {
        await write(other, 'update', [{ [`flags.essence20.${POINTS_FLAG}`]: pointsOf(other).filter(p => p.shareId != shareId) }]);
      }
    }
  }

  if (announce) {
    await say(actor, globalThis.game?.i18n?.format?.('E20.ResRuthlessSpent', { name: actor.name, count: amount }) ?? '');
  }

  return true;
}

registerStep('givePersonalPoints', async (step, ctx) => {
  const count = Math.max(1, Math.round(resolveValue(step.count ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  let list = recipients(step, ctx);
  if (Number(step.max) > 0) {
    list = list.slice(0, Number(step.max));
  }

  if (!list.length) {
    return false;
  }

  const label = ctx.actor?.name ?? '';
  const source = ctx.item?.name ?? '';
  const own = step.ownTurn ? { onOwnTurn: true } : {};
  if (step.shared) {
    const shareId = randomId();
    for (const actor of list) {
      await givePoints(actor, 1, { shareId, label, source, ...own });
    }

    ctx.chat.push(escape(T('PersonalPointShared', { name: label, list: list.map(actor => actor.name).join(', ') })));
    return;
  }

  for (const actor of list) {
    await givePoints(actor, count, { label, source, ...own });
    ctx.chat.push(escape(T('PersonalPointsGiven', { name: actor.name, count })));
  }
}, { errors: (step, where) => (step.max !== undefined && !(Number(step.max) > 0) ? [`${where}: max must be a positive number`] : []) });

registerEvent('personalPointUnspent');
registerEvent('storyPointNarrative');

registerTag('target:sameType', (rest, ctx) => (ctx.other ? !!ctx.self && ctx.other.type == ctx.self.type : false));

/** An actor's turn ended: personalPointUnspent for whoever listens, then its points tick down. */
export async function personalPointsTurnEnd(actor) {
  const points = pointsOf(actor);
  if (!points.length) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  for (const listener of worldActors().filter(other => rulesOfType(other, 'Trigger').some(entry => entry.rule.event == 'personalPointUnspent'))) {
    await fireTriggers(listener, 'personalPointUnspent', { targets: [actor] });
  }

  const { kept, expired } = afterTurnEnd(points);
  await write(actor, 'update', [{ [`flags.essence20.${POINTS_FLAG}`]: kept }]);
  if (expired.length) {
    await say(actor, globalThis.game?.i18n?.format?.('E20.ResRuthlessExpired', { name: actor.name, count: expired.length }) ?? '');
  }
}

registerTurnEnd(actor => personalPointsTurnEnd(actor));

registerSceneAdvanced(async () => {
  const gm = globalThis.game?.users?.activeGM;
  if (gm ? gm.id != globalThis.game?.user?.id : !globalThis.game?.user?.isGM) {
    return;
  }

  for (const actor of worldActors()) {
    if (pointsOf(actor).length) {
      await actor.update({ [`flags.essence20.${POINTS_FLAG}`]: [] });
    }
  }
});

/** The tracker's narrative spend (Think Fast!'s "gain access to a tool"): storyPointNarrative with @var.kind. */
export async function onNarrativeSpend(who, kind) {
  if (!who?.items) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(who, 'storyPointNarrative', { vars: { kind: String(kind ?? '') } });
}

globalThis.Hooks?.on?.('essence20.storyPointNarrative', (who, kind) => {
  onNarrativeSpend(who, kind).catch(error => console.error('Essence20 | storyPointNarrative failed', error));
});
