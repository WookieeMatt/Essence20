import { actorHasPerk } from "./perks.mjs";
import { getUses, markUsed } from "./scene-clock.mjs";

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

const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
// Rapid Reload (GI Joe CRB, Infantry base, 3rd level, p.79): "reloading weapons with the Reload
// trait is a Free action for you."
export const RAPID_RELOAD_ID = `${GI_JOE_CRB}c0woQ6aEyVd4DBvA`;
// Deep Magazines (GI Joe CRB, Heavy Ordnance Focus, 10th level, p.111): "ignore the first time you
// would need to reload per combat."
export const DEEP_MAGAZINES_ID = `${GI_JOE_CRB}REVp8LHYJFOqQ597`;
// Ammo Belt (GI Joe CRB and Transformers CRB, Weapon Upgrades): "Once per scene, reload this weapon
// as a Free action instead of a Move action." The same _id in both books' packs.
const AMMO_BELT_ITEM_ID = '92V9QrCXJYmY2p7O';
const AMMO_BELT_USED_FLAG = 'ammoBeltUsedThisScene';
const DEEP_MAGAZINES_USED_FLAG = 'deepMagazinesUsedThisCombat';

/**
 * Whether a weapon carries an Ammo Belt upgrade - attached by hand, or printed on a pre-upgraded
 * weapon such as "Machine Gun (Ammo Belt)". Read off the weapon's own attachment entries.
 * @param {Item} weapon
 * @returns {Boolean}
 */
export function hasAmmoBelt(weapon) {
  return Object.values(weapon?.system?.items ?? {}).some(entry => entry?.type == 'upgrade'
    && (String(entry.uuid ?? '').endsWith(`.${AMMO_BELT_ITEM_ID}`) || entry.name == 'Ammo Belt'));
}

/**
 * What reloading this weapon costs this actor right now: a Free action with Rapid Reload, or with
 * the weapon's Ammo Belt if it hasn't been used this scene (which this then spends); otherwise the
 * usual Move action.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<{action: String, source: ?String}>}   action is 'free' or 'move'; source names
 *   what made it free, for the action-economy log.
 */
export async function getReloadCost(actor, weapon) {
  if (actorHasPerk(actor, RAPID_RELOAD_ID)) {
    return { action: 'free', source: 'Rapid Reload' };
  }

  if (hasAmmoBelt(weapon) && getUses(weapon, AMMO_BELT_USED_FLAG, 'scene') < 1) {
    await markUsed(weapon, AMMO_BELT_USED_FLAG, { window: 'scene' });
    return { action: 'free', source: 'Ammo Belt' };
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

  if (game.combat && actorHasPerk(actor, DEEP_MAGAZINES_ID) && getUses(actor, DEEP_MAGAZINES_USED_FLAG) < 1) {
    await markUsed(actor, DEEP_MAGAZINES_USED_FLAG);
    ui.notifications?.info(game.i18n.format('E20.DeepMagazinesSkippedReload', { name: actor?.name ?? '', weapon: weapon.name }));
    return false;
  }

  await markWeaponNeedsReload(weapon);
  return true;
}
