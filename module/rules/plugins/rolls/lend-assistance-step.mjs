// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerStep } from "../../steps.mjs";

/**
 * Step `lendAssistance` - the actor takes the Lend Assistance action (mechanics/actions/lend-assistance.mjs#
 * activateLendAssistance: its own Skill / combat picker, refusals and payoffs); what it reports goes in the run's chat. A
 * cancelled or refused assist stops the run. I Got You's "Lend Assistance" Use.
 *
 * `skillOnly: true` (round 15, items2 - Help Yourself's clone): only the Skill half, no mode picker, from `radius` feet
 * (default 50) - lend-assistance.mjs#lendAssistanceSkill. No lendAssistance / assisted Triggers: someone else (the clone)
 * acts, not the actor. Nothing banked stops the run.
 */
registerStep('lendAssistance', async (step, ctx) => {
  if (step.skillOnly) {
    const { lendAssistanceSkill } = await import("../../../mechanics/actions/lend-assistance.mjs");
    const radius = Number(step.radius);
    return (await lendAssistanceSkill(ctx.actor, Number.isFinite(radius) && radius > 0 ? { radiusFeet: radius } : {})) ? undefined : false;
  }

  const { activateLendAssistance } = await import("../../../mechanics/actions/lend-assistance.mjs");
  const result = await activateLendAssistance(ctx.actor);
  if (!result || result.cancelled) {
    return false;
  }

  if (result.message) {
    ctx.chat.push(String(result.message));
  }
});
