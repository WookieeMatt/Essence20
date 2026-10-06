import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";

/**
 * Sprinting, shoving and slowing (round 15, uses):
 *   - Tag `self:sprinting` - the actor took the Sprint action this turn (the action-economy ledger's `sprinting`, on its
 *     combatant in the running combat); false out of combat.
 *   - Step `sprint {}` - the actor counts as Sprinting this turn (mechanics/actions/action-economy.mjs#setSprinting - its
 *     Move covers the Sprint distance); nothing out of combat.
 *   - Step `shove {bowlOver?}` - the Push / Shove action's roll against the targeted creature (mechanics/combat/target-riders.mjs
 *     #rollShove: Might vs 12 with the size shifts, then push or Prone; `bowlOver` - both, no choice). It warns and does
 *     nothing without an adjacent target.
 *   - Step `slow {feet, to?}` - each recipient's Movement is `feet` shorter on its next turn in the running combat
 *     (mechanics/combat/forced-movement.mjs#slowNextTurn); nothing out of combat.
 */

registerTag('self:sprinting', (rest, ctx) => {
  const combat = ctx.combat ?? globalThis.game?.combat;
  const combatant = ctx.self && combat?.getCombatantsByActor ? combat.getCombatantsByActor(ctx.self)?.[0] : null;
  return !!combatant?.getFlag?.('essence20', 'actions')?.sprinting;
}, { phrase: ['{who} {is} Sprinting', '{who} {isnt} Sprinting'] });

registerStep('sprint', async (step, ctx) => {
  const { setSprinting } = await import("../../../mechanics/actions/action-economy.mjs");
  await setSprinting(ctx.actor, true);
});

registerStep('shove', async (step, ctx) => {
  const { rollShove } = await import("../../../mechanics/combat/target-riders.mjs");
  const result = await rollShove(ctx.actor, { bowlOver: !!step.bowlOver });
  return result?.cancelled ? false : undefined;
});

registerStep('slow', async (step, ctx) => {
  const { resolveValue } = await import("../../formula.mjs");
  const { slowNextTurn } = await import("../../../mechanics/combat/forced-movement.mjs");
  const feet = Math.max(0, Math.round(resolveValue(step.feet ?? 5, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 5)));
  for (const actor of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    await slowNextTurn(actor, feet);
  }
}, { errors: (step, where) => (step.feet === undefined || Number.isFinite(Number(step.feet)) || typeof step.feet == 'string' ? [] : [`${where}: slow feet must be a number`]) });
