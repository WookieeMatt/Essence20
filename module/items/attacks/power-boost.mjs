/**
 * Power Boost (Across the Stars, Silver Ranger, 3rd/10th/17th level, p.57): "As a Free action,
 * spend 2 Personal Power to activate Power Boost. While active, your Power Weapon attacks deal an
 * additional [1/2/3, by level] Energy damage." An on/off toggle (like Dig In's own isDugIn/
 * toggleDigIn), but unlike Dig In this one costs Personal Power specifically to switch ON -
 * switching back off is free, matching RAW's silence on any cost/gate for turning it off.
 *
 * The damage-bonus half is read directly in dice.mjs's own damageBonusValue computation
 * (isPowerBoostActive alongside actorHasPerk and the attack's parent weapon carrying the
 * `powerWeapon` trait - the same trait check Red Ranger Prime's identical clause already uses).
 * "While active" has no active expiry beyond the player switching it back off - the same
 * "approximate duration, don't hard-enforce it" idiom Dig In/Got To Get Tough already accept.
 */
const POWER_BOOST_FLAG = 'powerBoostActive';

export function isPowerBoostActive(actor) {
  return !!actor.getFlag?.('essence20', POWER_BOOST_FLAG);
}

/**
 * Flips the actor's own Power Boost stance. Turning it ON spends 2 Personal Power (returns null,
 * spending nothing, if the actor can't afford it); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state (true = now active), or null if activation was
 *   attempted but couldn't be afforded (the flag is left unchanged in that case).
 */
export async function togglePowerBoost(actor) {
  const nowActive = !isPowerBoostActive(actor);
  if (nowActive) {
    if (actor.system.powers.personal.value < 2) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
  }

  await actor.setFlag('essence20', POWER_BOOST_FLAG, nowActive);
  return nowActive;
}
