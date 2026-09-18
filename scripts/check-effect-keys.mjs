#!/usr/bin/env node
/**
 * Validates every Active Effect change key stored in packs/&lt;pack&gt;/_source/*.json against the
 * effect catalog (module/helpers/effect-catalog.mjs) - the same vocabulary the Effect Wizard
 * offers. Catches the failure mode this system has shipped repeatedly: a key with a typo in it
 * looks completely normal on the sheet and simply never applies, because Foundry resolves it to
 * nothing and moves on silently.
 *
 * Reported as errors (exit 1):
 *  - unknown keys (typos, or a field that does not exist)
 *  - empty keys (v14's Actor#applyActiveEffects skips these explicitly)
 * Reported as warnings (exit 0):
 *  - keys targeting a computed field the catalog marks readOnly, which derived-data prep
 *    overwrites - legal to write, almost never what the author meant
 *
 * Handles both stored shapes: the v13-era `changes[]` with a numeric `mode` (what is on disk
 * today - core migrates it at load time) and v14's `system.changes[]` with a string `type`.
 *
 * Usage: node scripts/check-effect-keys.mjs [--verbose]
 * Exit code 0 if every key resolves, 1 otherwise (suitable for a CI step).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { isKnownKey, parseKey, suggestKey, readChanges } from "../module/helpers/effect-catalog.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKS = join(ROOT, "packs");
const VERBOSE = process.argv.includes("--verbose");

const errors = [];
const warnings = [];
let documentsScanned = 0;
let changesScanned = 0;
const keyCounts = new Map();

/**
 * Every effect on a document, whether it is an Item/Actor with embedded effects or a
 * standalone ActiveEffect document (v14 made those compendium-able in their own right).
 * @param {Object} doc
 * @returns {Array<Object>}
 */
function effectsOf(doc) {
  if (Array.isArray(doc.effects)) {
    return doc.effects;
  }

  // A standalone ActiveEffect document carries its changes directly.
  return (doc.changes || doc.system?.changes) ? [doc] : [];
}

for (const pack of readdirSync(PACKS, { withFileTypes: true })) {
  if (!pack.isDirectory()) {
    continue;
  }

  const source = join(PACKS, pack.name, "_source");
  if (!existsSync(source)) {
    continue;
  }

  for (const file of readdirSync(source)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const path = join(source, file);
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, "utf-8"));
    } catch (err) {
      errors.push(`${pack.name}/${file}: unreadable JSON (${err.message})`);
      continue;
    }

    documentsScanned++;

    for (const effect of effectsOf(doc)) {
      for (const change of readChanges(effect)) {
        changesScanned++;
        const key = change.key;
        keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);

        const where = `${pack.name}/${file} → "${doc.name ?? effect.name ?? "?"}"`;

        if (!key) {
          errors.push(`${where}: change with an empty key (it can never apply)`);
          continue;
        }

        if (!isKnownKey(key)) {
          const suggestion = suggestKey(key);
          errors.push(
            `${where}: unknown key "${key}"${suggestion ? ` - did you mean "${suggestion}"?` : ""}`,
          );
          continue;
        }

        const entry = parseKey(key);
        if (entry?.property.readOnly) {
          warnings.push(
            `${where}: "${key}" targets a computed field, which derived-data prep overwrites`,
          );
        }
      }
    }
  }
}

if (VERBOSE) {
  const sorted = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\nKey usage across the packs:");
  for (const [key, count] of sorted) {
    console.log(`  ${String(count).padStart(4)}  ${key || "(empty)"}`);
  }
}

console.log(
  `\nChecked ${changesScanned} Active Effect changes across ${documentsScanned} pack documents `
  + `(${keyCounts.size} distinct keys).`,
);

for (const warning of warnings) {
  console.warn(`  WARN  ${warning}`);
}

for (const error of errors) {
  console.error(`  FAIL  ${error}`);
}

if (errors.length) {
  console.error(`\n${errors.length} invalid Active Effect key(s) found.`);
  process.exit(1);
}

console.log(`All Active Effect keys resolve.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
