// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { formulaError, resolveValue } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Step `keepTargets {max}` - the run's targets are cut to the first `max` (a formula: `1 + floor((@var.rollTotal - 10) / 5)`,
 * `@var.n`), in the order they came: "the first N enemies within range" (Bumper Crop, Entropic Sponge). Below 1 keeps
 * none, and the run stops (nobody to act on).
 */
registerStep('keepTargets', async (step, ctx) => {
  const max = Math.floor(Number(resolveValue(step.max ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 1)) || 0);
  ctx.targets = max > 0 ? (ctx.targets ?? []).slice(0, max) : [];
  return ctx.targets.length > 0;
}, { errors: (step, where) => (step.max === undefined ? [`${where}: keepTargets needs max`] : formulaError(step.max) ? [`${where}.max: ${formulaError(step.max)}`] : []) });
