import { resolveValue } from "../../formula.mjs";

/**
 * A step's number (count, amount, within...) worked out as a formula, rounded: the run's actor, item and vars, the first
 * target as `other`, and the recipient it's being worked out for (when there is one). Shared by the group D steps.
 */
export const stepAmount = (value, ctx, fallback = 0, recipient = null) => Math.round(resolveValue(value, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null, recipient }, fallback));
