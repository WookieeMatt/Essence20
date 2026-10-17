import { resolveValue } from "../../formula.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { write } from "../shared/zord-crew-lookups.mjs";

/**
 * Round 16 (part a): banked rerolls and a reroll grant's own use count, as steps (Power Infusion).
 *
 *   bankReroll {to?, upTo? | values?}   each recipient gets a reroll charge - flags.essence20.bankedReroll {values,
 *                                       source}: its next attack rerolls the Skill dice showing one of `values`
 *                                       (`upTo: N` - 1 to N, a formula: "@item.system.advances.currentValue"; default
 *                                       [1]), and the charge is used up once an attack succeeds (dice.mjs, a miss keeps
 *                                       it). A new charge replaces an old one.
 *   rerollLimit {reset?, max?, spend?}  the rule item's own reroll grant's use count (mechanics/rolls/reroll.mjs - the
 *                                       count its reactive reroll button on the chat card keeps, `item:<the item's
 *                                       uuid>`, reset scene | day | combat | turn): without `spend` the run stops
 *                                       (warning E20.RerollMaxUsesReached) when `max` (default 1) are used; with
 *                                       `spend: true` one more is counted. So a Use and the item's reactive reroll share
 *                                       "once per scene".
 */

function valuesOf(step, ctx) {
  if (Array.isArray(step.values) && step.values.length) {
    return step.values.map(Number).filter(Number.isFinite);
  }

  const upTo = Math.round(resolveValue(step.upTo ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1));
  return Number.isFinite(upTo) && upTo > 0 ? Array.from({ length: upTo }, (_, i) => i + 1) : [1];
}

registerStep('bankReroll', async (step, ctx) => {
  const values = valuesOf(step, ctx);
  const source = ctx.item?.name ?? '';
  for (const actor of recipients(step, ctx)) {
    await write(actor, 'update', [{ 'flags.essence20.bankedReroll': { values, source } }]);
  }
}, { errors: (step, where) => (step.values !== undefined && !Array.isArray(step.values) ? [`${where}: bankReroll values must be a list of numbers`] : []) });

const RESETS = ['scene', 'day', 'combat', 'turn'];

registerStep('rerollLimit', async (step, ctx) => {
  if (!ctx.actor || !ctx.item?.uuid) {
    return false;
  }

  const { canUseReroll, consumeRerollUsage } = await import("../../../mechanics/rolls/reroll.mjs");
  const config = { maxUses: Math.max(1, Number(step.max) || 1), reset: step.reset ?? 'scene' };
  const key = `item:${ctx.item.uuid}`;
  if (step.spend) {
    await consumeRerollUsage(ctx.actor, config, key);
    return;
  }

  if (!(await canUseReroll(ctx.actor, config, key))) {
    globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.('E20.RerollMaxUsesReached') ?? 'E20.RerollMaxUsesReached');
    return false;
  }
}, { errors: (step, where) => (step.reset !== undefined && !RESETS.includes(step.reset) ? [`${where}: rerollLimit reset must be ${RESETS.join(', ')}`] : []) });
