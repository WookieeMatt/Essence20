import { resolveValue } from "../../formula.mjs";
import { interpolate } from "../../predicate.mjs";

/**
 * Round 15 (items2): a run's text filled the way the core `chat` step fills it (rules/steps.mjs#fillText) - {choice.<key>}
 * (a pick on the rule's item), {var.<key>}, {@<formula>} - plus {name} (the actor) and {target} (the run's first target).
 */
export function fillRunText(text, ctx) {
  return (interpolate(String(text ?? ''), ctx.item) ?? String(text ?? ''))
    .replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? ''))
    .replace(/\{(@[^}]+)\}/g, (match, formula) => String(Math.round(resolveValue(formula, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 0))))
    .replace(/\{name\}/g, ctx.actor?.name ?? '')
    .replace(/\{target\}/g, ctx.targets?.[0]?.name ?? '');
}
