import { epochFor, getUses } from "../../../mechanics/resources/scene-clock.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { resolveValue } from "../../formula.mjs";
import { windowFlag } from "./vehicle-budget-pieces.mjs";
import { write } from "../shared/side-and-copy-helpers.mjs";

/**
 * Group F: Scene Clock window counters a rule shares with hand-written code (or with other rules) by their flag name -
 * the `{epoch, window, count}` records mechanics/resources/scene-clock.mjs#markUsed writes (flags.essence20.<flag>). A rule `limit`
 * keeps its own record under ruleUses.<key>; these name the flag outright, so a count older code (or another item)
 * already keeps carries on unchanged.
 *
 *   tag   self:windowUsed:<flag>:<window>[:<n>]     the actor's count under that flag in the current scene / encounter /
 *         target:windowUsed:...  holder:windowUsed:...   mission window is at least n (default 1)
 *   step  markWindow {flag, window, to?, clear?}     count one more use on each recipient (a fresh window starts at 1);
 *                                                    `clear: true` forgets the record instead
 *         Round 15 (items2 - Motor Pool Connections): `count` (a formula) counts that many at once, and the flag may read a
 *         pick or a value ({choice.x} / {var.x} - plugins/resources/vehicle-budget-pieces.mjs#windowFlag).
 */

export const WINDOWS = ['scene', 'encounter', 'mission'];

/** Whether `actor` has used `flag` at least n times in the window. "<flag>:<window>[:<n>]". */
export function windowUsed(actor, rest) {
  const [flag, window = 'encounter', count = '1'] = String(rest ?? '').split(':');
  if (!flag || !WINDOWS.includes(window)) {
    return null;
  }

  if (!actor) {
    return false;
  }

  return getUses(actor, flag, window) >= (Number(count) || 1);
}

registerTag('self:windowUsed', (rest, ctx) => windowUsed(ctx.self, rest), { phrase: (arg, w) => w.windowUsed(arg) });
registerTag('target:windowUsed', (rest, ctx) => windowUsed(ctx.other ?? null, rest), { phrase: (arg, w) => w.windowUsed(arg) });
registerTag('holder:windowUsed', (rest, ctx) => windowUsed(ctx.holder ?? ctx.self, rest), { phrase: (arg, w) => w.windowUsed(arg) });

/** One more use (or `count` more) of `flag` in its window on `actor` (or, clear, the record gone). */
export async function markWindow(actor, flag, window, { clear = false, count = 1 } = {}) {
  if (!actor) {
    return;
  }

  if (clear) {
    await write(actor, 'unsetFlag', ['essence20', flag]);
    return;
  }

  await write(actor, 'setFlag', ['essence20', flag, { epoch: epochFor(window), window, count: getUses(actor, flag, window) + count }]);
}

registerStep('markWindow', async (step, ctx) => {
  const flag = /[{]/.test(String(step.flag)) ? windowFlag(step.flag, ctx) : String(step.flag);
  const count = step.count === undefined ? 1 : Math.max(0, Math.round(resolveValue(step.count, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  for (const actor of recipients(step, ctx)) {
    await markWindow(actor, flag, step.window ?? 'encounter', { clear: !!step.clear, count });
  }
}, {
  errors: (step, where) => [
    ...(typeof step.flag == 'string' && /^[\w{}.-]+$/.test(step.flag) ? [] : [`${where}: markWindow needs a flag name`]),
    ...(step.clear || WINDOWS.includes(step.window ?? 'encounter') ? [] : [`${where}: markWindow window must be one of ${WINDOWS.join(', ')}`]),
  ],
});
