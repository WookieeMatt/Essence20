/**
 * Unmovable (Finster's Monster-Matic Cookbook, Path of Stone, 15th level, p.297): "At 15th level,
 * you can spend 1 Personal Power as a Free action to become rooted to the spot. All attempts to
 * forcibly move or Maneuver you in any way until you move for any reason (including choosing to do
 * so) suffer a ↓3 penalty."
 *
 * Same on/off actor-flag toggle as Dig In (helpers/dig-in.mjs), but costs 1 Personal Power to turn
 * ON (Power Boost's own togglePowerBoost shape, helpers/power-boost.mjs) - free to turn back off,
 * matching RAW's own silence on any cost/gate for ending it. "Until you move for any reason" has no
 * active enforcement (this system has no movement-completion hook), the same "approximate
 * duration, don't hard-enforce it" idiom Dig In's own identical clause already accepts - a
 * player/GM toggles it back off manually.
 *
 * The ↓3-vs-Maneuver-attacks half is read directly in dice.mjs's own per-target modifier loop,
 * same Maneuver-damageType proxy (item.system.damageType == 'maneuver') Dig In/Steady Footing/Mega
 * Training Regimen already establish.
 */
const UNMOVABLE_FLAG = 'unmovableActive';

export function isUnmovableActive(actor) {
  return !!actor.getFlag?.('essence20', UNMOVABLE_FLAG);
}

/**
 * Flips the actor's own Unmovable stance. Turning it ON spends 1 Personal Power (returns null,
 * spending nothing, if the actor can't afford it); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation was
 *   attempted but couldn't be afforded (the flag is left unchanged in that case).
 */
export async function toggleUnmovable(actor) {
  const nowActive = !isUnmovableActive(actor);
  if (nowActive) {
    if (!(actor.system.powers?.personal?.value > 0)) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 1 });
  }

  await actor.setFlag('essence20', UNMOVABLE_FLAG, nowActive);
  return nowActive;
}
