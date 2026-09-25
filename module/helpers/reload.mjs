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
