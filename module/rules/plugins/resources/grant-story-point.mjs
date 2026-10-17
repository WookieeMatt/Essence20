import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { stepAmount as amount } from "../shared/step-amount.mjs";

/**
 * Story Point grants (round 15, dice part - docs/rules-batches/slDice15.md).
 *
 * - Step `grantStoryPoint {count?, pool?: story | gm | actor, optional?}` - adds `count` (default 1) Story Points through
 *   mechanics/resources/story-points.mjs#requestStoryPointGrant (the owner writes it, anyone else relays it to the GM).
 *   `pool` defaults to `story` (the team's pool, as the hand-written grants did); `actor` = the actor's own pool
 *   (poolFor - the GM's for a Threat). With nobody able to write the pool (no owner here, no GM connected) nothing is
 *   granted and the run stops quietly - so a limit isn't spent - unless `optional: true` (the run carries on).
 * - Rule type `FumbleStoryPoints {amount}` - the core "a Fumble adds a Story Point" grant (dice.mjs) adds `amount`
 *   instead of 1 while `when` holds (the biggest amount wins). `when` sees the rolled Skill (`skill:`) and item.
 */

const storyPoints = () => import("../../../mechanics/resources/story-points.mjs");

registerStep('grantStoryPoint', async (step, ctx) => {
  const helpers = await storyPoints();
  if (!helpers.canWriteStoryPoints()) {
    return !!step.optional;
  }

  const count = Math.max(0, amount(step.count ?? 1, ctx, 1));
  if (count > 0) {
    const pool = step.pool == 'actor' ? helpers.poolFor(ctx.actor) : step.pool ?? 'story';
    await helpers.requestStoryPointGrant(ctx.actor, count, { pool });
  }

  return true;
}, {
  errors: (step, where) => (step.pool !== undefined && !['story', 'gm', 'actor'].includes(step.pool) ? [`${where}: pool must be story, gm or actor`] : []),
});

registerRuleType('FumbleStoryPoints', {
  params: { amount: { kind: 'formula', required: true } },
  scopes: ['self'],
});

/**
 * How many Story Points the core Fumble grant adds for this actor's roll: the biggest FumbleStoryPoints amount whose
 * `when` holds, never below 1. `roll` is {rolledSkill, item}.
 */
export function ruleFumbleStoryPoints(actor, roll = {}) {
  let best = 1;
  for (const { rule, item } of rulesOfType(actor, 'FumbleStoryPoints')) {
    if (evaluate(rule.when, contextFor({ ...roll, self: actor, holder: actor, ruleItem: item })) !== true) {
      continue;
    }

    const value = Math.round(resolveValue(rule.amount, { actor, item }, 1));
    if (value > best) {
      best = value;
    }
  }

  return best;
}
