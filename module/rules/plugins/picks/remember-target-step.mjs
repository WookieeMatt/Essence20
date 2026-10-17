import { registerStep } from "../../steps.mjs";

/**
 * The rememberTarget step (round 10, group D - docs/rules-batches/slD10.md). Its own file so the step keeps its place
 * in the step list (after claimCard - see ../index.mjs).
 */

// rememberTarget {var}: the first target's uuid, kept for later steps ({var.<var>}) after the targets change.
registerStep('rememberTarget', async (step, ctx) => {
  const target = ctx.targets[0];
  if (!target && step.required !== false) {
    return false;
  }

  ctx.vars[step.var || 'target'] = target?.uuid ?? '';
});
