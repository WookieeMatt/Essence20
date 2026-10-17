import { resolveValue } from "../../formula.mjs";
import { recipients, registerStep, runSteps } from "../../steps.mjs";

/**
 * Group A (round 10): step `rollAs` {to, skill, dif, snag?, onSuccess?, onFail?} - each recipient rolls the Skill Test;
 * its branch runs with that recipient as the target.
 */

registerStep('rollAs', async (step, ctx) => {
  const { rollTest } = await import("../../../mechanics/resources/grants.mjs");
  const saved = ctx.targets;
  for (const roller of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    const dif = Math.round(resolveValue(step.dif ?? 10, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: roller }, 10));
    const result = await rollTest(roller, step.skill, dif, step.snag ? { snag: true } : {});
    ctx.vars.lastRoll = result;
    ctx.targets = [roller];
    const branch = result?.success ? step.onSuccess : step.onFail;
    if (Array.isArray(branch) && !(await runSteps(branch, ctx))) {
      ctx.targets = saved;
      return false;
    }
  }

  ctx.targets = saved;
}, {
  errors: (step, where) => (step.skill ? [] : [`${where}: rollAs needs a skill`]),
  branches: ['onSuccess', 'onFail'],
});
