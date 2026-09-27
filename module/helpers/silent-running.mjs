import { grantItemEntry } from "../sheet-handlers/attachment-handler.mjs";
import { createId } from "./utils.mjs";

/**
 * Silent Running (Factions in Action Vol. 1: Ferocious Fighters, Force Recon General Perk, p.44):
 * "Any battledress you requisition gains the Silent trait. In addition, you gain two free weapon
 * upgrades: two Silencer, two Suppressors, or one of each. These free weapon upgrades do not
 * affect weapon availability." "You are no longer trained in Heavy [armor]" is already a plain
 * compendium Active Effect (system.trained.armors.heavy: false) and needs no code.
 *
 * The "battledress you requisition gains Silent" half is NOT built - like Early Adopter's own
 * dropped ally-upgrade clause, this needs the Equipment Assignment/Requisition phase's own
 * allocation flow to inject a trait onto whatever gets requisitioned LATER, which doesn't exist
 * as addressable infrastructure here.
 *
 * The two free weapon upgrades ARE built, reusing Blend In's own grantItemEntry()/
 * setEntryAndAddItem() mechanism (attachment-handler.mjs) - the same "fold an upgrade into a
 * parent Item's own system.items map" idiom, just targeting the actor's own equipped WEAPON
 * instead of their armor. RAW's own 3-way choice ("two Silencer, two Suppressors, or one of
 * each") collapses to "one of each" - granting two copies of the SAME upgrade would need a second,
 * distinguishable map entry that _hasUpgrade's own "does a matching uuid already exist" dedup
 * check (borrowed unchanged from Blend In) can't tell apart from the first, so "one of each" is
 * the only one of the three options this mechanism can represent without a false no-op. A
 * one-time grant onto whichever ONE weapon Item is currently equipped, same "no live re-check if
 * gear changes later" simplification as Blend In.
 */
const SILENCER_ID = "Compendium.essence20.gi_joe_crb.Item.rSP76BWjYaifJLIZ";
const SUPPRESSOR_ID = "Compendium.essence20.ferocious_fighters.Item.sHBEBigG2y63MSWL";

function _hasUpgrade(weaponItem, upgradeId) {
  return Object.values(weaponItem.system.items ?? {}).some(entry => entry.uuid == upgradeId);
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether an equipped weapon Item was found to attach onto.
 */
export async function grantSilentRunningUpgrades(actor) {
  const weaponItem = actor.items.find(item => item.type == 'weapon' && item.system.equipped);
  if (!weaponItem) {
    return false;
  }

  if (!_hasUpgrade(weaponItem, SILENCER_ID)) {
    await grantItemEntry(createId(weaponItem.system.items ?? {}), { uuid: SILENCER_ID }, actor, weaponItem);
  }

  if (!_hasUpgrade(weaponItem, SUPPRESSOR_ID)) {
    await grantItemEntry(createId(weaponItem.system.items ?? {}), { uuid: SUPPRESSOR_ID }, actor, weaponItem);
  }

  return true;
}
