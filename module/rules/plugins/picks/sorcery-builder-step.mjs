// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the buildSorcerousPower step.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe (the builder dialog is loaded lazily).
import { registerStep } from "../../steps.mjs";

/**
 * Step `buildSorcerousPower {}` - opens the Sorcerous Power builder (Finster's Monster-Matic Cookbook Table 4-1,
 * items/magic/temper-tempest-sorcery-builder.mjs - a bespoke dialog of the table's rows); the Power it describes is
 * created on the actor at its point cost (a warning when that goes over the Sorcerous budget - the sheet's own
 * committed / max), and the builder's line goes to the run's chat. A cancelled dialog stops the run. The Sorcery
 * Perk's Use rule: `{type: Use, steps: [{do: buildSorcerousPower}]}`.
 */
registerStep('buildSorcerousPower', async (step, ctx) => {
  if (!ctx.actor) {
    return false;
  }

  const builder = await import("../../../items/magic/temper-tempest-sorcery-builder.mjs");
  const line = await builder.buildSorcerousPower(ctx.actor);
  if (!line) {
    return false;
  }

  ctx.chat.push(line);
});
