import { fireTriggers } from "../../triggers.mjs";
import { registerEvent } from "../../types.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { write } from "../shared/copy-and-data-helpers.mjs";

/**
 * Round 15 (items2) - Unexpected Alternative's trigger, an enemy who had only seen one Alt Mode seeing the other for
 * the first time:
 *
 *   event converted      the actor now stands in an Alt Mode - it Converted (system.isTransformed turned on) or switched
 *                        Alt Mode while converted (system.altModeId changed); @var.altMode is the Alt Mode's id. Fired by
 *                        the user who made the change.
 *   step recordSeen {flag, entry, to?, var?}
 *                        a per-creature memory kept on the actor: for each recipient (in a forEach, the target), the
 *                        values it has seen under flags.essence20.<flag>.<its uuid, dots as dashes>. `entry` ({var.x},
 *                        {choice.x}, {@formula} filled) is added; before that @var.<var>Count is how many it had seen,
 *                        <var>New 1 when this one is new to it, and <var>Switched 1 when it had seen exactly one other.
 *                        (var defaults to seen.)
 */

registerEvent('converted');

const flagKey = uuid => String(uuid ?? '').replace(/\./g, '-');

export function convertedChange(actor, changed) {
  const system = changed?.system ?? {};
  if (!('isTransformed' in system) && !('altModeId' in system)) {
    return null;
  }

  return actor?.system?.isTransformed && actor.system.altModeId ? actor.system.altModeId : null;
}

globalThis.Hooks?.on?.('updateActor', (actor, changed, options, userId) => {
  if (userId != globalThis.game?.user?.id) {
    return;
  }

  const altMode = convertedChange(actor, changed);
  if (altMode) {
    fireTriggers(actor, 'converted', { vars: { altMode } })?.catch?.(error => console.error('Essence20 | converted Triggers failed', error));
  }
});

registerStep('recordSeen', async (step, ctx) => {
  const name = step.var || 'seen';
  const { fillRunText } = await import("../shared/run-text.mjs");
  const value = fillRunText(String(step.entry ?? ''), ctx);
  const flag = String(step.flag ?? '');
  if (!value || !flag || !ctx.actor) {
    return false;
  }

  const table = { ...(ctx.actor.flags?.essence20?.[flag] ?? {}) };
  for (const other of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    const key = flagKey(other?.uuid);
    if (!key) {
      continue;
    }

    const seen = Array.isArray(table[key]) ? table[key] : [];
    ctx.vars[`${name}Count`] = seen.length;
    ctx.vars[`${name}New`] = seen.includes(value) ? 0 : 1;
    ctx.vars[`${name}Switched`] = seen.length == 1 && seen[0] != value ? 1 : 0;
    if (!seen.includes(value)) {
      table[key] = [...seen, value];
    }
  }

  await write(ctx.actor, 'update', [{ [`flags.essence20.${flag}`]: table }]);
  globalThis.foundry?.utils?.setProperty?.(ctx.actor, `flags.essence20.${flag}`, table);
}, {
  errors: (step, where) => [
    ...(typeof step.flag == 'string' && /^[\w-]+$/.test(step.flag) ? [] : [`${where}: recordSeen needs a flag name`]),
    ...(step.entry ? [] : [`${where}: recordSeen needs an entry`]),
  ],
});
