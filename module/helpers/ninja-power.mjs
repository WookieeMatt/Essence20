/**
 * Ninja Power (Power Rangers CRB, General Perk, p.97, prereq Max Personal Power 4+): "You can
 * spend 1 Power in conjunction with your It's Morphin Time! Role Perk to activate your Ninja
 * Power. While Morphed with Ninja Power, the following is true: your unarmed attacks inflict +1
 * damage; you have Edge on all Speed-based skills; you may choose an elemental type of damage
 * your Finesse-based Unarmed Combat attacks inflict; you may, as a Free action, jump up to 20 feet
 * in any direction... any attacks targeting you this turn after this jump suffer -1."
 *
 * Same on/off toggle shape as Power Boost (pay 1 Power to switch ON, free to switch back OFF) -
 * "in conjunction with It's Morphin Time!" is read as an independent activation a player can
 * toggle alongside Morphing, not something auto-triggered by it, since this codebase has no hook
 * into the Morph action itself beyond onMorph's own handful of already-wired grants.
 *
 * Built: the +1 unarmed damage and Speed Edge (both gated on being Morphed, read live in
 * dice.mjs), plus the elemental-type choice for unarmed Finesse attacks (reusing the generic
 * elementDamageType choiceType and the Void Warrior/Blazing Strikes/Cryogenic Touch damage-type-
 * override chain already established there).
 *
 * NOT built: the 20ft Free-action jump (narrative/unenforced, the same "spend the cost, narrate
 * the rest" idiom every other movement grant without real token-placement uses) and its own
 * "attacks against you this turn suffer -1" clause - that clause is tied to WHEN the jump happens
 * (a player action this codebase has no hook into), not a a general Morphed-state effect, so it
 * can't be modeled as a live check the way the other two clauses can - not a general Morphed-state
 * effect at all.
 */
const NINJA_POWER_FLAG = 'ninjaPowerActive';

export function isNinjaPowerActive(actor) {
  return !!actor.getFlag?.('essence20', NINJA_POWER_FLAG);
}

/**
 * Flips the actor's own Ninja Power stance. Turning it ON spends 1 Personal Power (returns null,
 * spending nothing, if the actor can't afford it); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation was
 *   attempted but couldn't be afforded (the flag is left unchanged in that case).
 */
export async function toggleNinjaPower(actor) {
  const nowActive = !isNinjaPowerActive(actor);
  if (nowActive) {
    if (actor.system.powers.personal.value < 1) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  }

  await actor.setFlag('essence20', NINJA_POWER_FLAG, nowActive);
  return nowActive;
}
