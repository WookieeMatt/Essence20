import { getSceneEpoch } from "../../../mechanics/resources/scene-clock.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { registerEvent } from "../../types.mjs";
import { write } from "../shared/card-text-helpers.mjs";

/**
 * The Hidden state as engine data (round 11, group G). The Hide action (mechanics/actions/hidden-state.mjs - an
 * Infiltration roll declared as Hide) marks the actor Hidden for the scene (flags.essence20.o3Hidden {epoch, at});
 * attacking while Hidden ends it, and hide.mjs then fires the `brokeHiding` event.
 *
 *   tags   self:hidden / target:hidden      Hidden in the current scene
 *   step   hide {to?, value?}               mark the recipients (default the actor) Hidden for the scene; value: false
 *                                           ends it
 *   event  brokeHiding                      the actor attacked while Hidden (Hidden is already over): its targets are
 *                                           the attack's targets, @var.targets how many (Pop Out)
 */

export const HIDDEN_FLAG = 'o3Hidden';

export function isHidden(actor) {
  const record = actor?.flags?.essence20?.[HIDDEN_FLAG];
  return !!record && record.epoch == getSceneEpoch();
}

/** Hidden on or off (owners write directly, others through the GM). */
export async function setHidden(actor, hidden) {
  if (!actor) {
    return;
  }

  if (hidden) {
    await write(actor, 'update', [{ [`flags.essence20.${HIDDEN_FLAG}`]: { epoch: getSceneEpoch(), at: Date.now() } }]);
  } else if (actor.flags?.essence20?.[HIDDEN_FLAG]) {
    await write(actor, 'update', [{ [`flags.essence20.${HIDDEN_FLAG}`]: new foundry.data.operators.ForcedDeletion() }]);
  }
}

registerTag('self:hidden', (rest, ctx) => (ctx.self ? isHidden(ctx.self) : null), { phrase: ['{who} {is} Hidden', '{who} {isnt} Hidden'] });
registerTag('target:hidden', (rest, ctx) => (ctx.other ? isHidden(ctx.other) : false), { phrase: ['{who} {is} Hidden', '{who} {isnt} Hidden'] });

registerStep('hide', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    await setHidden(actor, step.value !== false && step.value !== 'false');
  }
});

registerEvent('brokeHiding');

/** hide.mjs: the actor attacked while Hidden - fire its brokeHiding Triggers with the attack's targets. */
export async function fireBrokeHiding(actor, targets = []) {
  const unique = [...new Map(targets.filter(Boolean).map(target => [target.uuid ?? target, target])).values()];
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'brokeHiding', { targets: unique, vars: { targets: unique.length } });
}
