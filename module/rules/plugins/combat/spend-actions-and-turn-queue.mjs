import { registerTurnStart } from "../../../mechanics/item-hooks.mjs";
import { interpolate } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { escape, listOf, write } from "../shared/chat-speaker-helpers.mjs";
import { stepAmount as amount } from "../shared/step-amount.mjs";

/**
 * Actions spent now or at the start of someone's turn (round 10, group D - docs/rules-batches/slD10.md): the
 * spendActions and queueTurnStart steps, and the turn-start hook that runs the queue.
 */

// spendActions {action, count, atomic?}: spend that many actions of a kind (in combat); stops when one can't be paid
// (atomic: giving back the ones it already spent).
registerStep('spendActions', async (step, ctx) => {
  const count = Math.max(0, amount(step.count ?? 1, ctx, 1));
  if (!globalThis.game?.combat) {
    return;
  }

  const { spend, refund } = await import("../../../mechanics/actions/action-economy.mjs");
  const spent = [];
  for (let i = 0; i < count; i++) {
    const paid = await spend(ctx.actor, step.action ?? 'free', { source: ctx.item?.name ?? null });
    if (paid?.blocked) {
      // atomic (round 16, part a): all or nothing - the ones already spent are given back (Get A Grip's two Free actions).
      for (const spendId of step.atomic ? spent : []) {
        await refund(ctx.actor, spendId);
      }

      return false;
    }

    if (paid?.spendId) {
      spent.push(paid.spendId);
    }
  }
}, { errors: (step, where) => (step.action && !['free', 'move', 'standard'].includes(step.action) ? [`${where}: action must be free, move or standard`] : []) });

/* -------------------------------------------- */
/*  At the start of someone's turn               */
/* -------------------------------------------- */

const QUEUE_FLAG = 'ruleTurnQueue';

/**
 * queueTurnStart {to, spendAction?, whisper?}: when each recipient's next turn starts in this combat, it spends that
 * action (when the action economy is tracking) and its owners are told `whisper` ({var.x} filled now).
 */
registerStep('queueTurnStart', async (step, ctx) => {
  const text = step.whisper ? (interpolate(String(step.whisper), ctx.item) ?? String(step.whisper)).replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? '')).replace(/\{name\}/g, ctx.actor?.name ?? '') : '';
  for (const actor of recipients(step, ctx)) {
    const queue = Array.isArray(actor.flags?.essence20?.[QUEUE_FLAG]) ? actor.flags.essence20[QUEUE_FLAG] : [];
    await write(actor, 'update', [{ [`flags.essence20.${QUEUE_FLAG}`]: [...queue, {
      action: step.spendAction ?? null, text, source: ctx.item?.name ?? '', combatId: globalThis.game?.combat?.id ?? null,
    }] }]);
  }
}, { errors: (step, where) => (step.spendAction && !['free', 'move', 'standard'].includes(step.spendAction) ? [`${where}: spendAction must be free, move or standard`] : []) });

export async function runTurnQueue(actor, combat) {
  const queue = actor?.flags?.essence20?.[QUEUE_FLAG];
  if (!Array.isArray(queue) || !queue.length) {
    return;
  }

  await actor.update({ [`flags.essence20.${QUEUE_FLAG}`]: [] });
  for (const entry of queue) {
    if (entry.combatId && entry.combatId != combat?.id) {
      continue;
    }

    if (entry.action) {
      const { isTracking, spend } = await import("../../../mechanics/actions/action-economy.mjs");
      if (isTracking()) {
        await spend(actor, entry.action, { source: entry.source });
      }
    }

    if (entry.text && globalThis.ChatMessage?.create) {
      const owners = listOf(globalThis.game?.users).filter(user => user.isGM || actor.testUserPermission?.(user, 'OWNER')).map(user => user.id);
      await globalThis.ChatMessage.create({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor }), content: `<p>${escape(entry.text)}</p>`, whisper: owners });
    }
  }
}

registerTurnStart((actor, combat) => runTurnQueue(actor, combat));
