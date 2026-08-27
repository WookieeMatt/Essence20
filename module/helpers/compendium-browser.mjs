/**
 * Shared helpers for the Compendium Browser and its GM source-configuration screen.
 * Kept separate from both apps so neither has to import the other.
 */

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
