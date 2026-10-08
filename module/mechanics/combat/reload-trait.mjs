import { RELOAD_TWICE } from "./weapon-traits.mjs";
import { ruleSkipsReload } from "../../rules/plugins/combat/reload-skip.mjs";

/**
 * Reload (GI Joe CRB, Weapon Effects and Traits, p.147; the identical wording recurs in every
 * core rulebook's own Weapon Traits list, e.g. Transformers CRB, Power Rangers Across the Stars,
 * Welcome to Night Vale Citizen's Guide): after each shot the weapon needs a Move action to reload
 * before it can fire again.
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
 * What the reload costs, and when one is needed at all, is decided by getReloadCost/requireReload at
 * the end of this file: Rapid Reload and the Ammo Belt upgrade make it a Free action, Deep Magazines
 * skips the first reload each combat, and Empty the Mag also calls for one.
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
 * How many reloads the weapon still needs - 1 normally, 2 for a Reload ×2 weapon.
 */
export function reloadsNeeded(weapon) {
  const value = weapon?.getFlag?.('essence20', 'needsReload');
  return value === true ? 1 : Number(value) || 0;
}

/**
 * Flags a weapon as needing a Move action spent before it can fire again.
 * @param {Item} weapon
 */
export async function markWeaponNeedsReload(weapon, count = 1) {
  await weapon?.setFlag('essence20', 'needsReload', count > 1 ? count : true);
}

/**
 * Clears a weapon's reload flag - called once the Move action to reload it has actually been paid.
 * @param {Item} weapon
 */
export async function clearWeaponReload(weapon) {
  const left = reloadsNeeded(weapon) - 1;
  if (left > 0) {
    await weapon.setFlag('essence20', 'needsReload', left > 1 ? left : true);
    return;
  }

  await weapon?.unsetFlag('essence20', 'needsReload');
}

/**
 * Burst-Fire (Quartermaster's Guide to Gear p.33): counts as a pistol for Snap Shots, and firing it
 * twice in a round gives it Reload for that turn. The pistol-classification half isn't
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

// Rapid Reload (both printings), the Ammo Belt upgrade and the Bullpup upgrade are ActionCost {action: reload} rules on
// their items now (rules/plugins/resources/action-kinds.mjs; documents/item.mjs passes the reload's cost context).

/**
 * What reloading this weapon costs this actor right now: the usual Move action (an ActionCost rule - Rapid Reload, Ammo
 * Belt, Bullpup - may still make it cheaper when it's paid), or Free for a weapon whose own reload is.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<{action: String, source: ?String}>}   action is 'free' or 'move'; source names
 *   what made it free, for the action-economy log.
 */
export async function getReloadCost(actor, weapon) {
  // A weapon whose own reload is a Free action (the MLP Bow, MLP CRB p.151).
  if (weapon?.flags?.essence20?.reloadAction == 'free') {
    return { action: 'free', source: game.i18n.localize('E20.WeaponTraitReload') };
  }

  return { action: 'move', source: null };
}

/**
 * The weapon now needs a reload before it fires again - unless Deep Magazines hasn't been used yet
 * this combat, in which case this one is ignored (and says so). Every "must reload" in the system
 * goes through here: the Reload trait, a Fanning volley, Burst-Fire's second shot, Empty the Mag.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<Boolean>}   Whether the weapon was flagged (false when Deep Magazines skipped it).
 */
export async function requireReload(actor, weapon) {
  if (!weapon) {
    return false;
  }

  // Deep Magazines (first reload per combat) and Extended Mag (once per scene per weapon) are ReloadSkip rules
  // (rules/plugins/combat/reload-skip.mjs).
  if (await ruleSkipsReload(actor, weapon)) {
    return false;
  }

  // Reload ×2 (A Jump Through Time p.78): two reloads before it fires again.
  const sourceId = String(weapon.flags?.core?.sourceId ?? weapon._stats?.compendiumSource ?? weapon?.flags?.essence20?.rulesSource ?? '').split('.').pop();
  // Reload xN printed on the weapon itself (Cannonade x2, Catapult x4) - flags.essence20.reloadCount.
  const printedCount = Number(weapon.flags?.essence20?.reloadCount) || 1;
  await markWeaponNeedsReload(weapon, RELOAD_TWICE.includes(sourceId) ? 2 : printedCount);
  return true;
}
