// Round 15 (items1): BeforeRoll steps that read the rolled item and write the roll's dataset - steps targetCircle (Mighty
// Strikes) and setDataset, tag roll:firstRow (Terrifying Presence).
import { resolveValue } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * BeforeRoll steps (rules/plugins/dialog/dialog-select.mjs) see the item being rolled: `{rolled.<path>}` in step text
 * (a damage step's `damageType: "{rolled.system.damageType}"`), `@rolled.<path>` in amounts (`@rolled.system.totalReach`)
 * and `@var.rolledItem` (its uuid). (rules/steps.mjs fillText / amountOf read the run's `rolled`.)
 *
 * `targetCircle {radius}` - every token whose shape lies in a circle of `radius` feet (a formula) around the actor's own
 * token, the actor's token left out (either side), becomes the user's targets and the run's targets - the shape
 * mechanics/combat/aoe-targeting.mjs#getTokensInShape catches, as an Area of Effect does. No token on the canvas: nothing
 * changes.
 */
registerStep('targetCircle', async (step, ctx) => {
  const origin = ctx.actor?.getActiveTokens?.()?.[0];
  if (!origin) {
    return;
  }

  const { feetToPixels, getTokensInShape } = await import("../../../mechanics/combat/aoe-targeting.mjs");
  const feet = Number(resolveValue(step.radius ?? 0, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, rolled: ctx.rolled ?? null }, 0)) || 0;
  const center = origin.center ?? { x: origin.x, y: origin.y };
  const tokens = getTokensInShape({ type: 'circle', x: center.x, y: center.y, radius: feetToPixels(feet) }).filter(token => token !== origin);
  globalThis.canvas?.tokens?.setTargets?.(tokens.map(token => token.id));
  ctx.targets = [...new Set(tokens.map(token => token.actor).filter(Boolean))];
}, { errors: (step, where) => (step.radius === undefined ? [`${where}: targetCircle needs a radius`] : []) });

/**
 * `setDataset {key, data}` - in a BeforeRoll rule's steps: the roll's own dataset gets `data` (any value) under `key`, as a
 * hand-written pre-roll picker set it. `stepDamage: {value, type}` gives the check card Apply Damage buttons x Degrees of
 * Success (dice.mjs's synthetic damage); any other key is a flag the roll's afterRoll / hit Triggers read with
 * `roll:dataset:<key>[=<value>]`. Outside a roll (no dataset) it does nothing.
 */
registerStep('setDataset', async (step, ctx) => {
  if (ctx.dataset && step.key) {
    ctx.dataset[step.key] = globalThis.foundry?.utils?.deepClone?.(step.data) ?? JSON.parse(JSON.stringify(step.data ?? null));
  }
}, { errors: (step, where) => (step.key && step.data !== undefined ? [] : [`${where}: setDataset needs a key and data`]) });

/**
 * `roll:firstRow:success` / `roll:firstRow:failure` - in an afterRoll / hit Trigger: the roll's first row (its first
 * target, or its flat DIF) succeeded / failed. Unknown outside a posted roll.
 */
registerTag('roll:firstRow', (rest, ctx) => {
  const first = Array.isArray(ctx.results) ? ctx.results[0] : undefined;
  if (!first) {
    return null;
  }

  return rest == 'failure' ? !first.success : rest == 'success' ? !!first.success : null;
});
