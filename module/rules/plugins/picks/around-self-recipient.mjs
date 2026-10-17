import { resolveValue } from "../../formula.mjs";
import { registerRecipient } from "../../steps.mjs";
import { tokensAround } from "../combat/canvas-points.mjs";

/**
 * Round 15 (items2): recipient `aroundSelf:<formula>` - every creature whose token is within that many feet of the actor's
 * own token, the actor included (a radius worked out in the run: `aroundSelf:10 * @var.points` - Solid-State Energon's
 * blast). No token, or no grid to measure on: nobody.
 */
registerRecipient(/^aroundSelf:(.+)$/, (match, ctx) => {
  const own = ctx.actor?.token?.object ?? ctx.actor?.getActiveTokens?.()?.[0] ?? null;
  if (!own?.center) {
    return [];
  }

  const feet = Math.max(0, resolveValue(match[1], { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0));
  return [...new Set([ctx.actor, ...tokensAround(own.center, feet).map(token => token.actor)].filter(Boolean))];
});
