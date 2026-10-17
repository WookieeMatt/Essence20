import { registerStep, recipients, runSteps } from "../../steps.mjs";
import { resolveValue } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * Steps for rules a mark carries (round 10, group C) - in a carried Trigger the steps act on the marked creature, while
 * the rule's own item still belongs to whoever set the mark (the holder):
 *
 * - holderRoll {skill, dif, downshift?, edgeWhen?, onSuccess?, onFail?} - the HOLDER rolls the Skill (its own die),
 *   against `dif` and with `downshift` (formulas read the marked creature: @actor..., @mark.<key>); `edgeWhen` tags
 *   are asked of the holder. The branches act on the marked creature again. A cancelled roll stops the run. Ignite's
 *   fire attacking the burning creature at the end of its turn.
 * - spendActionOf {action, to} - the recipients spend that action (free, move, standard) in a running combat; out of
 *   combat nothing is spent. Stops when one can't pay. (A card button pressed by the one who has to act.)
 */

const holderOf = ctx => ctx.item?.parent ?? ctx.item?.actor ?? null;

registerStep('holderRoll', async (step, ctx) => {
  const holder = holderOf(ctx);
  if (!holder?._dice?.rollSkill) {
    return false;
  }

  const scope = { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null };
  const dif = Math.round(resolveValue(step.dif ?? 10, scope, 10));
  const shiftDown = Math.max(0, Math.round(resolveValue(step.downshift ?? 0, scope, 0)));
  const edge = Array.isArray(step.edgeWhen) && step.edgeWhen.length
    ? evaluate(step.edgeWhen, contextFor({ self: holder, ruleItem: ctx.item, other: ctx.actor })) === true : false;
  const essence = globalThis.CONFIG?.E20?.skillToEssence?.[step.skill] ?? 'smarts';
  const result = await holder._dice.rollSkill({ skill: step.skill, essence, dif: String(dif), shiftUp: 0, shiftDown, edge }, holder);
  if (!result || result.cancelled) {
    return false;
  }

  ctx.vars.lastRoll = { success: !!result.success };
  const branch = result.success ? step.onSuccess : step.onFail;
  return branch ? runSteps(branch, ctx) : undefined;
}, {
  // (The generic validator already walks onSuccess / onFail.)
  errors: (step, where) => (step.skill ? [] : [`${where}: holderRoll needs a skill`]),
});

registerStep('spendActionOf', async (step, ctx) => {
  if (!globalThis.game?.combat) {
    return;
  }

  const { spend } = await import("../../../mechanics/actions/action-economy.mjs");
  for (const actor of recipients(step, ctx)) {
    const paid = await spend(actor, step.action ?? 'free', { source: ctx.item?.name ?? null });
    if (paid?.blocked) {
      return false;
    }
  }
}, {
  errors: (step, where) => (['free', 'move', 'standard'].includes(step.action ?? 'free') ? [] : [`${where}: spendActionOf's action must be free, move or standard`]),
});
