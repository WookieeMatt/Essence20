import { formulaError } from "../../formula.mjs";
import { recipients, registerStep } from "../../steps.mjs";
import { stepAmount } from "../shared/step-amount.mjs";

/**
 * Step `healShared {formula, to, filter?}` (round 15, systems - docs/rules-batches/slSystems15.md): `formula` is rolled
 * ONCE and the Health is divided evenly among the recipients - each gets the total over their number, rounded down,
 * at least 1 - each up to their maximum. No recipients: nothing (and nothing rolled). `@var.healed` - the Health
 * actually restored in all. Repair Zord on a combined Megaform ("the amount healed is divided evenly amongst all
 * combined parts" - items/zords/zord-feature-picks.mjs#repairCombinedMegaform's shape).
 */
registerStep('healShared', async (step, ctx) => {
  const list = recipients(step, ctx).filter(actor => actor?.system?.health);
  if (!list.length) {
    ctx.vars.healed = 0;
    return;
  }

  const total = stepAmount(step.formula ?? 0, ctx, 0);
  const share = Math.max(1, Math.floor(total / list.length));
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  let healed = 0;
  for (const actor of list) {
    const health = actor.system.health;
    const next = Math.min(Number(health.max) || 0, (Number(health.value) || 0) + share);
    healed += Math.max(0, next - (Number(health.value) || 0));
    const update = { 'system.health.value': next };
    await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
  }

  ctx.vars.healed = healed;
}, {
  errors: (step, where) => (formulaError(step.formula ?? '') ? [`${where}: healShared needs a formula: ${formulaError(step.formula ?? '')}`] : []),
});
