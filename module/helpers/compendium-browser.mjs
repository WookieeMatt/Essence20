/**
 * Shared helpers for the Compendium Browser and its GM source-configuration screen.
 * Kept separate from both apps so neither has to import the other.
 */

import { E20 } from "./config.mjs";

/** All Item-type compendium packs currently available (system, module, or world). */
export function getItemPacks() {
  return Array.from(game.packs).filter(pack => pack.documentName === "Item");
}

/**
 * Item-type packs grouped by their compendium folder (e.g. "GI Joe", "My Little Pony"),
 * mirroring system.json's packFolders. Packs with no folder are grouped under "Other"
 * so world/module packs added later still show up somewhere.
 */
export function getGroupedItemPacks() {
  const otherLabel = game.i18n.localize("E20.CompendiumBrowserOtherBooks");
  const groups = new Map();

  for (const pack of getItemPacks()) {
    const groupName = pack.folder?.name || otherLabel;
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName).push(pack);
  }

  for (const packs of groups.values()) {
    packs.sort((a, b) => a.metadata.label.localeCompare(b.metadata.label));
  }

  return Array.from(groups.entries())
    .sort(([nameA], [nameB]) => {
      if (nameA === otherLabel) return 1;
      if (nameB === otherLabel) return -1;
      return nameA.localeCompare(nameB);
    })
    .map(([name, packs]) => ({ name, packs }));
}

/** Whether a GM has left the given pack enabled (default: enabled). */
export function isSourcebookEnabled(packId) {
  const disabled = game.settings.get("essence20", "enabledSourcebooks") ?? {};
  return disabled[packId] !== false;
}

/** The Item packs enabled for browsing - same list for the GM and everyone else. */
export function getVisibleItemPacks() {
  return getItemPacks().filter(pack => isSourcebookEnabled(pack.metadata.id));
}

/**
 * Applies the enabled/disabled sourcebook setting to each pack's actual ownership, so
 * a disabled book is hidden from players in Foundry's own Compendium sidebar tab too,
 * not just filtered out of the Compendium Browser. Only a GM can call this, since
 * pack.configure() writes a world-scope setting.
 */
export async function syncSourcebookOwnership() {
  for (const pack of getItemPacks()) {
    const desiredPlayerLevel = isSourcebookEnabled(pack.metadata.id) ? "OBSERVER" : "NONE";
    if (pack.ownership.PLAYER === desiredPlayerLevel) continue;

    await pack.configure({ ownership: { ...pack.ownership, PLAYER: desiredPlayerLevel } });
  }
}

/**
 * Turn off every sourcebook that belongs to a game line other than the one this world is
 * running, and turn the rest back on.
 *
 * This is what the "Game Line" setting does: a GI Joe table has no use for the Power Rangers
 * and My Little Pony books cluttering the Compendium Browser, so picking a line hides them.
 * It sets the DEFAULT, not a rule - the Configure Sourcebooks screen still has the final say,
 * and a GM who wants one book from another line can switch it back on there afterwards.
 *
 * The line filter applies to this system's OWN books only. Packs from a module or the world
 * are left exactly as the GM set them - picking a line must not reach into third-party content.
 *
 * Within this system's books, anything outside the chosen line's folder goes off, including a
 * book that sits in no folder at all. Field Guide to Action and Adventure is the one that does:
 * it is genuinely cross-line (107 items, 100 of them carrying no line at all), which is why it
 * has no folder - but "not from any one game" still is not "from this game", and an earlier
 * rule that skipped un-foldered packs left it switched on under every line. Turning it off is
 * a default, not a verdict: switch it back on under Configure Sourcebooks.
 *
 * Note this REPLACES the enabled/disabled map rather than merging into it: changing the game
 * line is a reset to that line's default, including for books within the line that had been
 * switched off by hand.
 * @param {string} line   A key of E20.gameVersions, or "" for every line.
 * @returns {Promise<void>}
 */
export async function applyGameLineToSourcebooks(line) {
  // Writes a world setting and pack ownership - both GM-only.
  if (!game.user?.isGM) {
    return;
  }

  const keep = E20.gameLinePackFolders[line];

  // No line selected (or an unrecognised one) means every line is available, so no book is
  // some OTHER line's and the map stays empty. Guarding on `keep` rather than on `line` is
  // what makes that true: without it an unmatched line leaves keep undefined, every folder
  // compares unequal to it, and the selection that is meant to enable everything disables
  // every book instead.
  const disabled = {};
  if (keep) {
    for (const pack of getItemPacks()) {
      if (pack.metadata.packageType !== 'system' || pack.metadata.packageName !== 'essence20') {
        continue;
      }

      if (pack.folder?.name !== keep) {
        disabled[pack.metadata.id] = false;
      }
    }
  }

  await game.settings.set("essence20", "enabledSourcebooks", disabled);
  await syncSourcebookOwnership();
  foundry.applications.instances.get("essence20-compendium-browser")?.refresh();
}
