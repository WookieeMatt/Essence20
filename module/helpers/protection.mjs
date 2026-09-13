/**
 * Protection (Quartermaster's Guide to Gear, Grid Power/nanomite power, p.94): "The nanomites
 * within your body strengthen your skin cells. You gain +1 to your Toughness. This nanomite power
 * is considered always on and does not count against your daily uses of nanomite powers. You may
 * expend a use of your nanomite power to add an additional +1 to your Toughness (+2 total) for 1
 * scene."
 *
 * Two-part, like every other "always on" nanomite power this project has built: the base +1
 * Toughness is a plain, permanent compendium Active Effect on `system.defenses.toughness.bonus`
 * (the same legitimate direct-target family Charge Into Battle's own Evasion bonus and Iron
 * Heart's own effect already use). The scene-boost half needs code - a toggle, dispatched here,
 * matching the "expend a use, toggle a bonus on, free to switch back off" shape Dig In already
 * established. RAW's own "daily uses of nanomite powers" resource isn't tracked anywhere in this
 * codebase (`usesInterval`/`usesPer` are schema-only fields, never read by any code - confirmed via
 * grep), so - like Dig In's own toggle - there's nothing to actually charge for switching this on;
 * left free rather than invented into a resource this system doesn't have.
 */
const PROTECTION_BOOST_FLAG = 'protectionBoostActive';
const PROTECTION_BOOST_BONUS = 1;

export function isProtectionBoostActive(actor) {
  return !!actor.getFlag?.('essence20', PROTECTION_BOOST_FLAG);
}

/**
 * Flips the Protection scene-boost on/off for this actor.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   The new state (true = now active).
 */
export async function toggleProtectionBoost(actor) {
  const nowActive = !isProtectionBoostActive(actor);
  await actor.setFlag('essence20', PROTECTION_BOOST_FLAG, nowActive);
  return nowActive;
}

/**
 * The scene-boost's own live, non-consumed Toughness bonus while active (0 otherwise) - read in
 * dice.mjs's per-target checkEntries construction, the same shape Lightshield Armor/Powered
 * Plating already established (can't touch _prepareDefenses).
 * @param {Actor} actor
 * @returns {Number}
 */
export function getProtectionBoostBonus(actor) {
  return isProtectionBoostActive(actor) ? PROTECTION_BOOST_BONUS : 0;
}
