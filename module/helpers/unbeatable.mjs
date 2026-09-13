import { actorHasPerk } from "./perks.mjs";

/**
 * Unbeatable (GI Joe CRB, Renegade base, 11th level, p.97): "at the start of each of your turns,
 * you heal 1 Damage if you have half of your Health (and bonus Health) or fewer remaining. You
 * don't gain this benefit if you are Defeated." `system.health.max` already folds in any bonus
 * Health (Reckless Abandon's own healthBonus grant included - see documents/actor.mjs's own
 * _prepareHealth), so "half of your Health (and bonus Health)" is just `health.max / 2` - no
 * separate bonus-Health lookup needed. Wired into essence20.mjs's existing combatTurn/combatRound
 * hooks alongside healStunAtTurnStart, for whoever's turn is starting.
 * @param {Actor} actor
 */
const UNBEATABLE_ID = "Compendium.essence20.gi_joe_crb.Item.cyiPxpwROFcBZZkm";

export async function healUnbeatableAtTurnStart(actor) {
  if (!actorHasPerk(actor, UNBEATABLE_ID) || actor.statuses?.has('defeated')) {
    return;
  }

  const health = actor.system.health;
  if (health.value > 0 && health.value <= health.max / 2) {
    await actor.update({ 'system.health.value': Math.min(health.max, health.value + 1) });
  }
}
