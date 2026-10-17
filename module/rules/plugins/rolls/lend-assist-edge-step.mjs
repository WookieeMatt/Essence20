import { recipients, registerStep } from "../../steps.mjs";
import { escape, T, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * The lendAssistEdge step (round 10, group D - docs/rules-batches/slD10.md): Lend Assistance's Edge banked against a
 * creature for each recipient.
 */

// lendAssistEdge {to, against, actionEach?}: each recipient gets Lend Assistance's attack benefit (an Edge on its first
// attack against `against` - an actor uuid, {var.x} filled - mechanics/actions/lend-assistance.mjs's pendingLendAssistanceEdge),
// each costing `actionEach` (in combat; the first that can't be paid stops it).
registerStep('lendAssistEdge', async (step, ctx) => {
  const uuid = String(step.against ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
  const against = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  const foe = against?.documentName == 'Token' ? against.actor : against;
  if (!foe) {
    return false;
  }

  const combat = globalThis.game?.combat;
  const economy = combat && step.actionEach ? await import("../../../mechanics/actions/action-economy.mjs") : null;
  const granted = [];
  for (const ally of recipients(step, ctx)) {
    if (economy && (await economy.spend(ctx.actor, step.actionEach, { source: ctx.item?.name ?? null }))?.blocked) {
      break;
    }

    await write(ally, 'setFlag', ['essence20', 'pendingLendAssistanceEdge', { targetId: foe.id ?? null, edge: true, combatId: combat?.id ?? null, round: combat?.round ?? null }]);
    granted.push(ally.name);
  }

  if (granted.length) {
    ctx.chat.push(escape(T('AssistLent', { name: ctx.actor?.name ?? '', allies: granted.join(', '), target: foe.name })));
  }
}, { errors: (step, where) => (step.against ? [] : [`${where}: lendAssistEdge needs against`]) });
