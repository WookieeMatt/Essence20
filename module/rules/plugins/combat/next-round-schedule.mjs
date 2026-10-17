// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerStep, runSteps, stepContext } from "../../steps.mjs";
import { escapeHtml } from "../shared/left-b-text.mjs";

/**
 * Step `scheduleNextRound {steps, replace?}` - the steps run at the first turn start a round later, at or past this
 * point in the turn order (the next round at the same turn index, or any turn of the round after), in the combat the
 * run happened in - "on their next turn" read off the turn order rather than a combatant. Set out of combat, they never
 * run. `replace: true` - the actor's earlier entries from the same item go (one armed at a time). The run's targets and
 * plain values go with them, and `@var.actorUuid` / `{var.actorUuid}` is the actor's uuid when they run.
 *
 * `runScheduledNextRound(combat)` - called at every turn start (documents/combat.mjs#_onStartTurn, on the active GM):
 * every world actor's due entries run, as that actor, once. (Self-Destruct: "on their next turn the vehicle is
 * immediately Defeated and explodes".)
 */

const FLAG = 'ruleNextRound';

const plainVars = vars => Object.fromEntries(Object.entries(vars ?? {}).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value)));
const listOf = actor => (Array.isArray(actor?.flags?.essence20?.[FLAG]) ? actor.flags.essence20[FLAG] : []);

registerStep('scheduleNextRound', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const entry = {
    id: globalThis.foundry?.utils?.randomID?.() ?? String(Date.now()),
    itemUuid: ctx.item?.uuid ?? null,
    combatId: combat?.id ?? null, round: Number(combat?.round) || 0, turn: Number(combat?.turn) || 0,
    targets: (ctx.targets ?? []).map(target => target.uuid), vars: plainVars(ctx.vars), steps: Array.isArray(step.steps) ? step.steps : [],
  };
  const kept = step.replace ? listOf(ctx.actor).filter(old => old.itemUuid != entry.itemUuid) : listOf(ctx.actor);
  const { write } = await import("../shared/chat-speaker-helpers.mjs");
  await write(ctx.actor, 'update', [{ [`flags.essence20.${FLAG}`]: [...kept, entry] }]);
}, { branches: ['steps'] });

/** Whether an entry is due at this point of the combat. */
export function isDueNextRound(entry, combat) {
  if (!combat || !entry?.combatId || entry.combatId != combat.id) {
    return false;
  }

  const round = Number(combat.round) || 0;
  const turn = Number(combat.turn) || 0;
  return (round > entry.round && turn >= entry.turn) || round > entry.round + 1;
}

/** Run every world actor's due entries (the active GM only). */
export async function runScheduledNextRound(combat) {
  if (!globalThis.game?.user?.isActiveGM || !combat) {
    return;
  }

  const actors = globalThis.game?.actors?.contents ?? [...(globalThis.game?.actors ?? [])];
  for (const actor of actors) {
    const list = listOf(actor);
    const due = list.filter(entry => isDueNextRound(entry, combat));
    if (!due.length) {
      continue;
    }

    await actor.update({ [`flags.essence20.${FLAG}`]: list.filter(entry => !due.includes(entry)) });
    for (const entry of due) {
      const lookup = uuid => (uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null);
      const item = lookup(entry.itemUuid);
      const ctx = stepContext({ actor, item, targets: (entry.targets ?? []).map(lookup).filter(Boolean) });
      Object.assign(ctx.vars, entry.vars ?? {}, { actorUuid: actor.uuid });
      await runSteps(entry.steps ?? [], ctx);
      if (ctx.chat.length && globalThis.ChatMessage?.create) {
        await globalThis.ChatMessage.create({
          speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
          content: [`<strong>${escapeHtml(item?.name ?? '')}</strong>`, ...ctx.chat].join('<br>'),
        });
      }
    }
  }
}
