/**
 * Reload (GI Joe CRB, Weapon Effects and Traits, p.147; the identical wording recurs in every
 * core rulebook's own Weapon Traits list, e.g. Transformers CRB, Power Rangers Across the Stars,
 * Welcome to Night Vale Citizen's Guide): "Reloading this weapon is complicated. After firing this
 * weapon, you must spend a Move action to reload it before you can use it again."
 *
 * Modelled as a per-weapon Item flag ('needsReload') rather than a numeric ammo count - RAW never
 * gives a Reload-trait weapon a shot count, just a binary "loaded or not" state. A weapon starts
 * loaded (flag absent): the very first shot always fires free, exactly as printed; only a SECOND
 * consecutive shot without an intervening reload is gated.
 *
 * documents/item.mjs#roll is the single insertion point: it checks weaponNeedsReload() before
 * spending the attack's own action economy (an unreloaded weapon shouldn't cost an Attack action
 * at all), spending a Move action itself to clear the flag, then calls markWeaponNeedsReload()
 * right after a shot actually goes out (hit or miss - "after firing", not "after hitting").
 *
 * Not modelled: the Ammo Belt weapon upgrade ("once per scene, reload this weapon as a Free action
 * instead of a Move action") and the Rapid Reload Focus Perk - both re-cost this same Move action
 * rather than introducing a new concept, and are left for a follow-up once Reload itself has
 * shipped.
 */

/**
 * Whether this weapon is currently awaiting a reload.
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function weaponNeedsReload(weapon) {
  return !!weapon?.getFlag?.('essence20', 'needsReload');
}

/**
 * Flags a weapon as needing a Move action spent before it can fire again.
 * @param {Item} weapon
 */
export async function markWeaponNeedsReload(weapon) {
  await weapon?.setFlag('essence20', 'needsReload', true);
}

/**
 * Clears a weapon's reload flag - called once the Move action to reload it has actually been paid.
 * @param {Item} weapon
 */
export async function clearWeaponReload(weapon) {
  await weapon?.unsetFlag('essence20', 'needsReload');
}

/**
 * Burst-Fire (Quartermaster's Guide to Gear p.33): "Weapons with this trait count as pistols for
 * purposes of the Snap Shots General Perk... If fired more than once during the same round, this
 * weapon counts as if it had the Reload trait for the turn." The pistol-classification half isn't
 * built - this codebase has never automated Snap Shots itself (no PERK_ID constant for it exists
 * anywhere), so there is nothing to plug that classification into yet.
 *
 * The Reload-for-the-turn half is built directly on top of the Reload flag above: a round-scoped
 * "already fired once this round" flag on the weapon Item, stamped alongside markWeaponNeedsReload
 * itself (documents/item.mjs). A SECOND shot in the same round finds that flag already set and
 * calls markWeaponNeedsReload just like a genuine Reload-trait weapon would, so the EXISTING
 * Reload gate in item.mjs#roll (already checking traits.includes('reload') || the burstFire
 * trait itself) blocks the shot after that until a Move action pays it off - "for the turn" reads
 * as "until reloaded", the same simplification Reload's own doc comment already accepts for its
 * "before you can use it again" wording.
 */

/**
 * Whether this weapon has already fired once in the current round (Combat's own id/round pair,
 * so a stale flag from a previous encounter never matters).
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function hasBurstFiredThisRound(weapon) {
  const fired = weapon?.getFlag?.('essence20', 'burstFiredThisRound');
  return !!fired && !!game.combat && fired.combatId == game.combat.id && fired.round == game.combat.round;
}

/**
 * Stamps this round as the weapon's own "already fired" round. A no-op outside Combat - Burst-
 * Fire's own "during the same round" wording has nothing to count without one.
 * @param {Item} weapon
 */
export async function markBurstFiredThisRound(weapon) {
  if (weapon && game.combat) {
    await weapon.setFlag('essence20', 'burstFiredThisRound', { combatId: game.combat.id, round: game.combat.round });
  }
}
