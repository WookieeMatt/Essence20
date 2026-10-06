import { recipients, registerStep } from "../../steps.mjs";

/**
 * Steps that count or set the run's targets (round 10, group D - docs/rules-batches/slD10.md): countTargets,
 * countRecipients, targetRecipients, targetSelf. (rememberTarget is ./remember-target-step.mjs.)
 */

// countTargets {var}: how many targets the run has (@var.<var>).
registerStep('countTargets', async (step, ctx) => {
  ctx.vars[step.var || 'targets'] = ctx.targets.length;
});

// countRecipients {to, filter?, var}: how many actors `to` reaches (@var.<var>).
registerStep('countRecipients', async (step, ctx) => {
  ctx.vars[step.var || 'count'] = recipients(step, ctx).length;
});

// targetRecipients {to, filter?}: the actors `to` reaches become the run's targets (nothing on the canvas changes) - a
// list that later steps reach with to: target / targets, kept even when what chose them changes.
registerStep('targetRecipients', async (step, ctx) => {
  ctx.targets = recipients(step, ctx);
});

// targetSelf: the actor itself becomes the run's target (a button card it posts carries it to the presser).
registerStep('targetSelf', async (step, ctx) => {
  ctx.targets = ctx.actor ? [ctx.actor] : [];
});
