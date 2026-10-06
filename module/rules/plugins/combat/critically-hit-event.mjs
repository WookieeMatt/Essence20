// Round 15 (items1): the `criticallyHit` Trigger event - Imperial Machine Mantle.
import { registerEvent } from "../../types.mjs";

/**
 * `criticallyHit` - fired on whoever a Critical Success's damage is applied to (chat.mjs#onApplyDamage, after the hit
 * found who it lands on and every reduction ran, whatever damage is left - even none), the attacker (the card's
 * speaker, when known) as its target. Imperial Machine Mantle falls to pieces on it.
 */
registerEvent('criticallyHit');

/**
 * @param {Actor} actor       Who the Critical Success's damage lands on.
 * @param {?Actor} attacker   Who rolled it.
 */
export async function criticallyHit(actor, attacker = null) {
  if (!actor) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'criticallyHit', { targets: attacker ? [attacker] : [] });
}
