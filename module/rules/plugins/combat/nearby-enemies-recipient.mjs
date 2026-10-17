import { getNearbyEnemyTokens } from "../../../mechanics/combat/nearby-enemies.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerRecipient } from "../../steps.mjs";

/**
 * Recipient `nearbyEnemies:<ft>` (round 14, banked) - every token within that range whose disposition differs from the
 * actor's own, neutral ones included: mechanics/combat/nearby-enemies.mjs#getNearbyEnemyTokens, the way the hand-written
 * area Perks (Absolute Menace, Nemesis Drain, Group Strike...) gathered their targets. `enemies:<ft>` leaves neutral
 * tokens out; this doesn't. The range may be a formula (`nearbyEnemies:@item.system.advances.currentValue`).
 * Each actor once, in token order.
 */
export function nearbyEnemies(actor, feet) {
  const actors = getNearbyEnemyTokens(actor, feet).map(token => token.actor).filter(Boolean);
  return [...new Set(actors)];
}

registerRecipient(/^nearbyEnemies:(.+)$/, (match, ctx) => {
  const feet = Number(resolveValue(match[1], { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 0)) || 0;
  return feet > 0 ? nearbyEnemies(ctx.actor, feet) : [];
});
