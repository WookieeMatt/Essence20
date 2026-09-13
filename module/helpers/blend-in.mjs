import { grantItemEntry } from "../sheet-handlers/attachment-handler.mjs";
import { createId } from "./utils.mjs";

/**
 * Blend In (Ferocious Fighters, Tiger Force General Perk, p.37; prerequisite: Infiltration +d4):
 * "Your Battledress gains the Silent Upgrade and the Stealth Upgrade automatically. These
 * upgrades don't affect the availability of your Battledress." "Battledress" has no dedicated
 * schema classification anywhere in this codebase (confirmed via grep) - it's just GI Joe's own
 * flavor term for whatever armor a Ranger wears, so this targets whichever armor Item the actor
 * currently has equipped (system.equipped). Reuses grantItemEntry()/setEntryAndAddItem() directly
 * - the exact same "fold an upgrade into a parent armor/weapon Item's own system.items map"
 * mechanism attachment-handler.mjs already uses for a player's own manual upgrade drag-and-drop -
 * just triggered at Perk-grant time instead of a drop event. A one-time grant, not a live re-check:
 * if the actor equips different armor later, the upgrades don't follow automatically (this
 * codebase has no "on equip" hook to re-run this against), the same "approximate a passive effect,
 * GM manages the edges" idiom this project already accepts elsewhere. No-ops (per upgrade) if the
 * equipped armor already carries a matching entry, so re-granting (e.g. taking this Perk twice
 * somehow) never double-attaches.
 */
const SILENT_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.nftZIaQ3MVn2nviU";
const STEALTH_UPGRADE_ID = "Compendium.essence20.gi_joe_crb.Item.ThXrre0RHTcr1BEp";

function _hasUpgrade(armorItem, upgradeId) {
  return Object.values(armorItem.system.items ?? {}).some(entry => entry.uuid == upgradeId);
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether an equipped armor Item was found to attach onto.
 */
export async function grantBlendInUpgrades(actor) {
  const armorItem = actor.items.find(item => item.type == 'armor' && item.system.equipped);
  if (!armorItem) {
    return false;
  }

  if (!_hasUpgrade(armorItem, SILENT_UPGRADE_ID)) {
    await grantItemEntry(createId(armorItem.system.items ?? {}), { uuid: SILENT_UPGRADE_ID }, actor, armorItem);
  }

  if (!_hasUpgrade(armorItem, STEALTH_UPGRADE_ID)) {
    await grantItemEntry(createId(armorItem.system.items ?? {}), { uuid: STEALTH_UPGRADE_ID }, actor, armorItem);
  }

  return true;
}
