import { getVisibleItemPacks } from "./compendium-browser.mjs";

/**
 * Matches the named Perks/Powers/Hang-Ups a stat block prints against Items that already exist in
 * the system's compendium packs. Phase 4 of docs/STAT_BLOCK_IMPORTER_PLAN.md.
 *
 * This is the highest-value part of the importer. A bare world Item carrying a name and some text
 * is inert: none of the system's automation can see it. A compendium Item created through
 * `game.items.fromCompendium()` keeps both its **Active Effects** and its
 * `_stats.compendiumSource`, and that sourceId is the provenance every `actorHasPerk` / reroll /
 * modifier-source check in this codebase matches on - so a matched Threat gets the existing
 * automation for free, where an unmatched one just looks right and does nothing.
 *
 * Split the same way the rest of this feature is: `loadCompendiumEntries` is the only async,
 * game-touching function here; the index, the lookup and the preference rules are pure and tested.
 *
 * **Scope**: Perks, Powers and Hang-Ups only. Attacks are deliberately NOT matched - a printed
 * stat block's own damage/range numbers are authoritative for that Threat (a Grown form's attack
 * is not the same weapon as the compendium's), and a compendium weapon's nested weaponEffects are
 * referenced by uuid rather than embedded, so reconstructing one is a different job from copying
 * a Perk. Weapons keep being built from the printed numbers, which is the right answer anyway.
 */

/** Which Item type each parsed IR section should be matched against. */
export const MATCHABLE_SECTIONS = {
  perks: 'perk',
  powers: 'power',
  hangUps: 'hangUp',
};

/**
 * Strips a name down to something comparable across a printed page and a compendium entry:
 * case, punctuation and spacing all vary ("Hang-Ups" vs "Hang Ups", "Powerful Leap!" vs
 * "Powerful Leap").
 */
export function normalizeItemName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The key one entry occupies in the match index. */
export function indexKey(type, name) {
  return `${type}::${normalizeItemName(name)}`;
}

/**
 * Builds the lookup used by `findMatches`.
 * @param {Object[]} entries   {name, type, uuid, packId, packLabel, folder} records.
 * @returns {Map<String, Object[]>}
 */
export function buildMatchIndex(entries) {
  const index = new Map();
  for (const entry of entries) {
    if (!entry?.name || !entry?.type) {
      continue;
    }

    const key = indexKey(entry.type, entry.name);
    if (!index.has(key)) {
      index.set(key, []);
    }

    index.get(key).push(entry);
  }

  return index;
}

/**
 * Picks one candidate out of everything sharing a name.
 *
 * A Perk name can legitimately appear in several books (the same General Perk is reprinted across
 * game lines), so the game line the GM picked decides it. With no preference, or when the
 * preference doesn't narrow things, the first candidate by pack label is taken so the result is at
 * least deterministic - but `ambiguous` is set so the UI can say a choice was made on the GM's
 * behalf rather than pretending there was only one.
 *
 * @param {Object[]} candidates
 * @param {String|null} preferFolder   Compendium folder name, e.g. "Power Rangers".
 * @returns {Object|null}
 */
export function selectMatch(candidates, preferFolder = null) {
  if (!candidates?.length) {
    return null;
  }

  const pool = preferFolder
    ? (candidates.filter(entry => entry.folder === preferFolder) || [])
    : [];
  const effective = pool.length ? pool : candidates;
  const sorted = [...effective].sort((a, b) =>
    (a.packLabel ?? '').localeCompare(b.packLabel ?? '') || (a.name ?? '').localeCompare(b.name ?? ''));

  return { ...sorted[0], ambiguous: effective.length > 1, candidateCount: candidates.length };
}

/**
 * Resolves every matchable entry in an IR against the index.
 * @param {Object} ir
 * @param {Map} index
 * @param {String|null} preferFolder
 * @returns {Object}   {perks: [{name, match}], powers: [...], hangUps: [...]}
 */
export function findMatches(ir, index, preferFolder = null) {
  const results = {};

  for (const [section, type] of Object.entries(MATCHABLE_SECTIONS)) {
    results[section] = (ir[section] ?? []).map(entry => ({
      name: entry.name,
      match: selectMatch(index.get(indexKey(type, entry.name)), preferFolder),
    }));
  }

  return results;
}

/** How many entries matched, for the preview's summary line. */
export function countMatches(matches) {
  let matched = 0;
  let total = 0;
  for (const entries of Object.values(matches ?? {})) {
    for (const entry of entries) {
      total += 1;
      if (entry.match) {
        matched += 1;
      }
    }
  }

  return { matched, total };
}

/**
 * How many matched entries carry Active Effects.
 *
 * **This is a real caveat, not a statistic.** A printed stat block's Defenses, Health and skill
 * shifts already have that Threat's own Perks baked into them - the book did the arithmetic. A
 * matched compendium Perk whose Active Effect ADDs to the same field therefore applies a bonus
 * that is already in the printed number, and the actor ends up stronger than the page says.
 * Verified live: importing a Threat with a matched "Never Back Down" (whose effect is
 * `system.health.bonus add 2`) turned a printed Health of 4 into a derived Health of 6.
 *
 * Automation is still worth having - most Perks' effects are conditional or non-numeric, and an
 * inert Perk gets a GM nothing - so this is surfaced as a caution for the GM to check rather than
 * a reason to refuse the match. A future pass could reconcile the two automatically by subtracting
 * an effect's contribution from the residual `.bonus` the builder computes (see the plan's §4.1),
 * which is a bigger job than Phase 4.
 *
 * @param {Object} matches
 * @returns {Number}
 */
export function countEffectBearingMatches(matches) {
  let count = 0;
  for (const entries of Object.values(matches ?? {})) {
    for (const entry of entries) {
      if (entry.match?.hasEffects) {
        count += 1;
      }
    }
  }

  return count;
}

/**
 * Reads every enabled Item pack's index into the flat record shape `buildMatchIndex` wants.
 * Respects the GM's own sourcebook toggles (helpers/compendium-browser.mjs#getVisibleItemPacks),
 * so a book switched off there is not silently matched against.
 *
 * Pack indexes are cached by Foundry after the first `getIndex()`, so calling this more than once
 * in a session is cheap.
 *
 * @returns {Promise<Object[]>}
 */
export async function loadCompendiumEntries() {
  const wanted = new Set(Object.values(MATCHABLE_SECTIONS));
  const entries = [];

  for (const pack of getVisibleItemPacks()) {
    let index;
    try {
      index = await pack.getIndex({ fields: ["type", "effects"] });
    } catch (err) {
      // One unreadable pack must not take the whole importer down - the rest still match.
      console.warn(`essence20 | Could not index pack "${pack.metadata.id}" for stat block matching.`, err);
      continue;
    }

    for (const record of index) {
      if (!wanted.has(record.type)) {
        continue;
      }

      entries.push({
        name: record.name,
        type: record.type,
        uuid: record.uuid ?? `Compendium.${pack.metadata.id}.Item.${record._id}`,
        packId: pack.metadata.id,
        packLabel: pack.metadata.label,
        folder: pack.folder?.name ?? null,
        // Drives the double-counting caution - see countEffectBearingMatches below.
        hasEffects: Boolean(record.effects?.length),
      });
    }
  }

  return entries;
}

/**
 * The compendium folder name for a game-version key. `CONFIG.E20.gameVersions`' own localized
 * values are exactly the packFolders names in system.json ("Power Rangers", "GI Joe", ...), so
 * no second mapping table is needed - it's the same string.
 */
export function folderForGameVersion(version) {
  if (!version) {
    return null;
  }

  return CONFIG.E20.gameVersions[version] ?? null;
}
