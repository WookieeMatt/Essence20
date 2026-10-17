#!/usr/bin/env node
/**
 * Verifies every Compendium UUID reference embedded in pack source content actually resolves to
 * a real document. Two shapes both appear across the content:
 *   - A whole-string reference, e.g. system.items.<key>.uuid on an Influence/Origin/Role that
 *     grants other items (Compendium.essence20.gi_joe_crb.Item.T3XgGSGuZsFVifsS).
 *   - An inline @UUID[...] link embedded in an HTML description/text field
 *     (@UUID[Compendium.essence20.decepticon_directive.Item.UO5WlCGHXtPOKFFY]).
 * Both are just the string "Compendium.essence20.<packName>.<Item|Actor>.<id>" somewhere inside
 * a string value, so this scans every string in every source file for that pattern rather than
 * hardcoding specific field names - these references aren't confined to one field, and a new one
 * showing up in a field this script doesn't know about would otherwise go unchecked.
 *
 * A UUID here can go stale in two ways: the pack name changed (a compendium got renamed) or the
 * target document got deleted/regenerated a new _id - both leave a granting item silently
 * pointing at nothing, which Foundry won't error on (fromUuid just resolves to null) but breaks
 * the grant at runtime. See docs/QA_PLAN.md §5.
 *
 * Usage: node scripts/check-pack-cross-references.mjs
 * Exit code 0 if every reference resolves, 1 otherwise (suitable for a CI step).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf-8"));

const UUID_PATTERN = /Compendium\.essence20\.([\w-]+)\.(?:Item|Actor)\.([a-zA-Z0-9]{16})/g;
const FOLDER_KEY_PREFIX = "!folders!";

/** Recursively collects every string value found anywhere in a JSON value. */
function collectStrings(value, out) {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
  } else if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      collectStrings(value[key], out);
    }
  }
}

// Build packName -> {sourceDir, validIds} for every pack that actually has content, and load
// every source file's parsed content once (reused for both the id index and the scan below).
const packsByName = new Map();
const filesByPack = new Map();

for (const pack of manifest.packs ?? []) {
  const sourceDir = join(ROOT, pack.path, "_source");
  if (!existsSync(sourceDir)) {
    continue; // Reported separately by check-manifest-sync.mjs.
  }

  const validIds = new Set();
  const files = [];
  for (const filename of readdirSync(sourceDir)) {
    if (!filename.endsWith(".json")) {
      continue;
    }

    let data;
    try {
      data = JSON.parse(readFileSync(join(sourceDir, filename), "utf-8"));
    } catch {
      continue; // Reported separately by check-pack-content.mjs.
    }

    const isFolder = typeof data._key === "string" && data._key.startsWith(FOLDER_KEY_PREFIX);
    if (!isFolder && typeof data._id === "string") {
      validIds.add(data._id);
    }

    files.push({ filename, data });
  }

  packsByName.set(pack.name, validIds);
  filesByPack.set(pack.name, files);
}

const problems = [];
let referencesChecked = 0;
const seenPerFile = new Set(); // Dedupe repeat mentions of the same broken reference in one file.

for (const [packName, files] of filesByPack) {
  for (const { filename, data } of files) {
    const strings = [];
    collectStrings(data, strings);
    seenPerFile.clear();

    for (const str of strings) {
      for (const match of str.matchAll(UUID_PATTERN)) {
        const [, targetPack, targetId] = match;
        referencesChecked++;

        const dedupeKey = `${targetPack}.${targetId}`;
        if (seenPerFile.has(dedupeKey)) {
          continue;
        }

        const targetIds = packsByName.get(targetPack);
        if (!targetIds) {
          problems.push(`${packName}/${filename}: references pack "${targetPack}", which doesn't exist.`);
          seenPerFile.add(dedupeKey);
          continue;
        }

        if (!targetIds.has(targetId)) {
          problems.push(`${packName}/${filename}: references "${targetPack}" item "${targetId}", which doesn't exist in that pack.`);
          seenPerFile.add(dedupeKey);
        }
      }
    }
  }
}

if (problems.length) {
  console.error(`Pack cross-reference check failed (${problems.length} problem(s) across ${referencesChecked} references checked):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log(`Pack cross-reference check passed: ${referencesChecked} Compendium UUID references all resolve.`);
