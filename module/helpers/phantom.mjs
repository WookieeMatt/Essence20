/**
 * Phantom (GI Joe CRB, Infiltrator Focus, 17th level, p.74): "In dim light or darkness, spend a
 * Free action to become invisible to natural eyesight until the beginning of your next turn. This
 * effect ends if you make a non-Takedown attack, take damage, or are exposed to bright light."
 *
 * The base grant (a plain self toggleStatusEffect('invisible'), Free action, no cost, no cap) was
 * already built - see banked-buffs.mjs's own PHANTOM_GIJ_ID dispatch. This file adds the two
 * "ends if..." clauses that ARE directly trackable, the same way helpers/invisibility.mjs's own
 * near-identical "until you take the Attack action" clause already hooks dice.mjs's post-attack
 * processing: making a non-Takedown attack (checkContext.isTakedownAttempt, dice.mjs's own existing
 * flag) and taking damage (helpers/combat.mjs#applyDamage, the same reactive touch-point Hardened
 * Armor's Resistance grant already uses). "Exposed to bright light" stays unbuilt - this system has
 * no scene lighting/darkness concept anywhere in code to check against (the same gap Environmental
 * Expertise's own "in your environment of expertise" self-policed toggle already documents).
 *
 * Own flag tracked separately from helpers/invisibility.mjs's INVISIBILITY_FLAG - both grant the
 * same real `invisible` status Condition, but are otherwise unrelated Perks from different actors'
 * own choices, so clearing one must never clear the other's grant.
 */
const PHANTOM_FLAG = 'phantomActive';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isPhantomActive(actor) {
  return !!actor.getFlag?.('essence20', PHANTOM_FLAG);
}

/**
 * Activates Phantom - sets the tracking flag and grants the real `invisible` status.
 * @param {Actor} actor
 */
export async function activatePhantom(actor) {
  await actor.setFlag('essence20', PHANTOM_FLAG, true);
  await actor.toggleStatusEffect('invisible', { active: true });
}

/**
 * Auto-clears Phantom the moment the actor makes a non-Takedown Attack - called from dice.mjs's
 * own post-roll processing, regardless of whether the attack hits (same "the attempt itself ends
 * it" framing deactivateInvisibilityOnAttack already uses).
 * @param {Actor} actor
 */
export async function deactivatePhantomOnAttack(actor) {
  await clearPhantom(actor);
}

/**
 * Auto-clears Phantom the moment the actor takes damage - called from helpers/combat.mjs#applyDamage.
 * @param {Actor} actor
 */
export async function deactivatePhantomOnDamage(actor) {
  await clearPhantom(actor);
}

/**
 * The shared no-op-if-already-off clear both auto-clear triggers above call.
 * @param {Actor} actor
 */
async function clearPhantom(actor) {
  if (!isPhantomActive(actor)) {
    return;
  }

  await actor.setFlag('essence20', PHANTOM_FLAG, false);
  await actor.toggleStatusEffect('invisible', { active: false });
}
