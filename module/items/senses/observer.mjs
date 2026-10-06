/**
 * Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72): "You can activate
 * your disguise using your Morpher as a Free action, spending 1 Personal Power. You gain ↑2 to
 * Deception Skill Tests. If you suffer a Snag on any Social-based Skill Tests regarding
 * understanding another species, you may suffer ↓2 on the Skill Test instead. If anyone attempts
 * to search or scan for you using any Technology-based Skill Tests, they suffer a Snag when
 * attempting to find or identify you."
 *
 * A single-purpose on/off toggle, the same "spend Power only to switch ON, free to switch back
 * OFF" shape as Power Boost - unlike Power Adaptation/Wisdom of the Elders, there's no choice of
 * WHICH option to activate; the Perk itself is the one ability.
 * - The ↑2 Deception grant lives in dice.mjs#rollSkill (same shape as Crushing Strength/Enhanced
 *   Reflexes).
 * - The Snag-to-downshift substitution ("regarding understanding another species") is checkbox-
 *   gated in the Roll Options Dialog, the player self-policing the fictional trigger - the same
 *   "no hook to verify the fiction, trust the player" idiom Aiming/Precision Aim already use.
 * - The reciprocal Snag on anyone Tech-scanning the disguised actor is a target-status check in
 *   _getAutomaticCombatModifiers, the same shape as Indomitable's own Intimidation-Snag check.
 */
const OBSERVER_FLAG = 'observerDisguiseActive';

/**
 * Whether the actor's disguise is currently switched on.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isObserverDisguiseActive(actor) {
  return !!actor.getFlag?.('essence20', OBSERVER_FLAG);
}

/**
 * Flips the disguise on/off. Turning it ON spends 1 Personal Power (returns null, spending
 * nothing, if the actor can't afford it); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation
 *   couldn't be afforded.
 */
export async function toggleObserverDisguise(actor) {
  const nowActive = !isObserverDisguiseActive(actor);

  if (nowActive) {
    if (actor.system.powers.personal.value < 1) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  }

  await actor.setFlag('essence20', OBSERVER_FLAG, nowActive);
  return nowActive;
}
