import { registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Rolling again (round 10, group D - docs/rules-batches/slD10.md): each actor's latest Skill Test kept before it rolls,
 * the captureRoll / retryRoll steps (retry it with a cumulative ↓) and recastFree (cast a spell again at no cost).
 */

/** Only plain values survive into a chat-card flag. */
export function plainDataset(dataset) {
  return Object.fromEntries(Object.entries(dataset ?? {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null));
}

/** Each actor's latest Skill Test as it started (dataset and item). */
export const LAST_ROLL = new Map();

registerPreRoll((actor, dataset, item) => {
  if (actor?.uuid) {
    LAST_ROLL.set(actor.uuid, { dataset: plainDataset(dataset), itemUuid: item?.uuid ?? null });
  }
});

/**
 * captureRoll {var}: the actor's latest Skill Test, kept in @var.<var> (a text the button cards carry) for a later
 * retryRoll; @var.chain is how many retries in a row this one would be.
 */
registerStep('captureRoll', async (step, ctx) => {
  const last = LAST_ROLL.get(ctx.actor?.uuid);
  if (!last) {
    return false;
  }

  const chain = (Number(last.dataset.e20RetryChain) || 0) + 1;
  const base = last.dataset.e20RetryBase ?? last.dataset.shiftDown ?? 0;
  ctx.vars[step.var || 'retry'] = JSON.stringify({ itemUuid: last.itemUuid, dataset: { ...last.dataset, e20RetryBase: base, e20RetryChain: chain } });
  ctx.vars.chain = chain;
});

/** The retried dataset: its base ↓ plus `downEach` per retry in the chain (cumulative). */
export function retryDataset(saved, downEach = 1) {
  const dataset = { ...(saved?.dataset ?? {}) };
  dataset.shiftDown = (Number(dataset.e20RetryBase) || 0) + (Number(dataset.e20RetryChain) || 0) * downEach;
  return dataset;
}

// retryRoll {var, downEach?}: roll the captured Skill Test again, ↓downEach per retry in the chain.
registerStep('retryRoll', async (step, ctx) => {
  let saved = null;
  try {
    saved = JSON.parse(String(ctx.vars?.[step.var || 'retry'] ?? ''));
  } catch (error) {
    saved = null;
  }

  if (!saved?.dataset || !ctx.actor?._dice?.rollSkill) {
    return false;
  }

  const item = saved.itemUuid ? await globalThis.fromUuid?.(saved.itemUuid) : null;
  await ctx.actor._dice.rollSkill(retryDataset(saved, Number(step.downEach ?? 1) || 1), ctx.actor, item);
});

// recastFree {item}: cast that spell again at no cost (item: {var.itemUuid} - the rolled item an afterRoll Trigger saw).
registerStep('recastFree', async (step, ctx) => {
  const uuid = String(step.item ?? '').replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? ''));
  const spell = uuid ? await globalThis.fromUuid?.(uuid) : null;
  if (!spell?.roll || spell.type != 'spell' || !ctx.actor?.isOwner) {
    return false;
  }

  await spell.roll({ rollType: 'spell', freeCast: true });
});
