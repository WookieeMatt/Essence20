import { registerEvent } from "../../types.mjs";

/**
 * Round 15 (items2): Trigger event `storyPointsPaid` - a pool really went down. Fired by
 * mechanics/resources/story-points.mjs#spend (the shared pool, `@var.pool` "story") and #spendGm (the GM's pool, "gm"),
 * right after the new value is written, on the client that wrote it (the GM, or a player who owns the Party), for the
 * spending actor when the spend named one. `@var.amount` is how many were spent. A personal (Ruthless) point is
 * spent before either pool is reached, so it never fires this. (`storyPointSpent` is the requester's side: every
 * spend a rule or the sheet asks for, any pool, before it is known to have gone through.)
 */
registerEvent('storyPointsPaid');

/** Fire the event (story-points.mjs calls it through the hook). */
export async function onStoryPointsPaid(actor, amount, pool) {
  if (!actor || !(Number(amount) > 0)) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'storyPointsPaid', { vars: { amount: Number(amount), pool: String(pool ?? 'story') } });
}

globalThis.Hooks?.on?.('essence20.storyPointsPaid', (actor, amount, pool) => {
  onStoryPointsPaid(actor, amount, pool).catch(error => console.error('Essence20 | storyPointsPaid Triggers failed', error));
});
