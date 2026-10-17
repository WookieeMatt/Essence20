import { recipients, registerRecipient, registerStep } from "../../steps.mjs";
import { T, write } from "../shared/chat-speaker-helpers.mjs";
import { stepAmount as amount } from "../shared/step-amount.mjs";

/**
 * Who pays, and paying (round 10, group D - docs/rules-batches/slD10.md): the driverOrSelf recipient (a Zord's pilot
 * pays for it) and the spendFor step.
 */

// driverOrSelf: a Zord's driver (its pilot pays), else the actor itself (a Zord with no driver, a Megaform, anyone else).
registerRecipient('driverOrSelf', (match, ctx) => {
  const actor = ctx.actor;
  if (actor?.type == 'zord') {
    const seat = Object.values(actor.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
    const driver = seat ? globalThis.fromUuidSync?.(seat.uuid, { strict: false }) ?? null : null;
    if (driver) {
      return [driver];
    }
  }

  return actor ? [actor] : [];
});

// spendFor {resource: {path}, amount, to}: each recipient pays from its own value at the path; the run stops (nothing
// taken) when one of them can't.
registerStep('spendFor', async (step, ctx) => {
  const path = step.resource?.path;
  const list = recipients(step, ctx);
  const value = Math.max(0, amount(step.amount ?? 1, ctx, 1));
  const have = actor => Number(path.split('.').reduce((at, key) => at?.[key], actor)) || 0;
  const short = list.find(actor => have(actor) < value);
  if (!list.length || short) {
    globalThis.ui?.notifications?.warn?.(T('CannotPay', { name: short?.name ?? '' }));
    return false;
  }

  for (const actor of list) {
    await write(actor, 'update', [{ [path]: have(actor) - value }]);
  }

  ctx.vars.spent = value;
}, { errors: (step, where) => (step.resource?.path ? [] : [`${where}: spendFor needs resource.path`]) });
