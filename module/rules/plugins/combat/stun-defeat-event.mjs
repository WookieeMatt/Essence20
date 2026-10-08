// Round 15 (items1): the `defeatedEnemyStun` Trigger event - CBRN Defender.
import { registerEvent } from "../../types.mjs";

/**
 * `defeatedEnemyStun` - fired on whoever dealt a Stun hit that Defeated someone (Stun reaching the target's remaining
 * Health: mechanics/combat/combat.mjs#applyDamage's own auto-Defeat), the Defeated as its target. `defeatedEnemy` only
 * hears Health reaching 0, so a rule that means "Defeats a creature through damage" listens to both. Not fired for a
 * creature that was already Defeated, or with no damage source (a rule `damage` step).
 */
registerEvent('defeatedEnemyStun');

/**
 * Called by combat.mjs#applyDamage right after a Stun hit toggled Defeated on `actor`.
 * @param {Actor} actor    Who was Defeated.
 * @param {?Actor} source  Who dealt the Stun (the chat card's speaker), when known.
 */
export async function stunDefeated(actor, source) {
  if (!source || !actor || source === actor || (source.uuid && source.uuid == actor.uuid)) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(source, 'defeatedEnemyStun', { targets: [actor] });
}
