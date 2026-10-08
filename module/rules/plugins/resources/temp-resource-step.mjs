import { recipients, registerStep } from "../../steps.mjs";
import { escape, T } from "../shared/chat-speaker-helpers.mjs";
import { stepAmount as amount } from "../shared/step-amount.mjs";

/**
 * The tempResource step (round 10, group D - docs/rules-batches/slD10.md): temporary Health / Energon through
 * mechanics/resources/temporary-resources.mjs's ledger (Together We Stand).
 */

// tempResource {kind: health | energon, amount, to, untilDamage?}: temporary Health / Energon through the resource
// slice's ledger (taken back at the scene's end); `amount` is worked out for each recipient. Energon only reaches
// actors that have it.
registerStep('tempResource', async (step, ctx) => {
  const { grantTemp } = await import("../../../mechanics/resources/temporary-resources.mjs");
  const kind = step.kind == 'energon' ? 'energon' : 'health';
  for (const actor of recipients(step, ctx)) {
    if (kind == 'energon' && !actor.system?.energon?.normal) {
      continue;
    }

    const value = Math.max(0, amount(step.amount ?? 1, ctx, 1, actor));
    await grantTemp(actor, { kind, amount: value, source: ctx.item?.name ?? '', by: ctx.actor?.uuid ?? null, untilDamage: !!step.untilDamage });
    ctx.chat.push(escape(T(kind == 'energon' ? 'TempEnergon' : 'TempHealth', { name: actor.name, amount: value })));
  }
}, { errors: (step, where) => (step.kind && !['health', 'energon'].includes(step.kind) ? [`${where}: kind must be health or energon`] : []) });
