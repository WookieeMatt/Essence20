#!/usr/bin/env node
/**
 * Validates every packs/&lt;pack&gt;/_source/*.json file's basic structure - well-formed JSON,
 * required top-level fields present, "type" is one of this system's actual registered
 * Actor/Item types (system.json's documentTypes), "_id" is a valid Foundry document id, and
 * "_key" (LevelDB's own record key) is internally consistent with the file's own _id and its
 * pack's declared document type. See docs/QA_PLAN.md §1/§5.
 *
 * This is deliberately a *structural* check, not full DataModel schema validation (each item's
 * "system" block against its actual field definitions in module/data/item/*.mjs) - that would
 * need a real foundry.data.fields implementation (SchemaField/StringField/etc. with working
 * clean()/validate()), which @foundryvtt/foundryvtt-cli doesn't expose (it only provides
 * compilePack/extractPack, used by `gulp compile`/`gulp extract`) and Foundry itself only runs
 * inside a real client. A hand-rolled stand-in field hierarchy faithful enough to be trustworthy
 * is a much larger undertaking than this catches-obvious-hand-edit-mistakes check.
 *
 * Usage: node scripts/check-pack-content.mjs
 * Exit code 0 if every source file is structurally sound, 1 otherwise (suitable for a CI step).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf-8"));

const VALID_TYPES = {
  Actor: new Set(Object.keys(manifest.documentTypes?.Actor ?? {})),
  Item: new Set(Object.keys(manifest.documentTypes?.Item ?? {})),
};

// Foundry document ids are 16-character base62 (alphanumeric) strings.
const ID_PATTERN = /^[a-zA-Z0-9]{16}$/;
const REQUIRED_KEYS = ["_id", "name", "type", "img", "system"];
// Compendium folders live alongside real Item/Actor documents in the same _source directory,
// but are a different shape entirely (Folder documents: name/type/sorting/color/_key, no
// img/system) - their own "type" is just "Item"/"Actor" (which document type this folder
// organizes), not one of this system's registered content types, so they need their own,
// much lighter check rather than being run through the Item/Actor rules below.
const FOLDER_KEY_PREFIX = "!folders!";

const problems = [];
let filesChecked = 0;

for (const pack of manifest.packs ?? []) {
  const documentType = pack.type; // "Actor" or "Item"
  const sourceDir = join(ROOT, pack.path, "_source");
  if (!existsSync(sourceDir)) {
    continue; // Already reported by check-manifest-sync.mjs - avoid double-reporting here.
  }

  const validTypes = VALID_TYPES[documentType];
  const expectedKeyPrefix = `!${documentType.toLowerCase()}s!`;

  for (const filename of readdirSync(sourceDir)) {
    if (!filename.endsWith(".json")) {
      continue;
    }

    filesChecked++;
    const filePath = join(sourceDir, filename);
    const label = `${pack.name}/${filename}`;

    let data;
    try {
      data = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      problems.push(`${label}: not valid JSON (${err.message}).`);
      continue;
    }

    const isFolder = typeof data._key === "string" && data._key.startsWith(FOLDER_KEY_PREFIX);
    if (isFolder) {
      // A folder's own required shape is much smaller (no img/system/registered content type).
      if (!("_id" in data) || !("name" in data)) {
        problems.push(`${label}: folder document missing "_id" or "name".`);
      }

      if (data._id !== undefined && !ID_PATTERN.test(data._id)) {
        problems.push(`${label}: "_id" ("${data._id}") isn't a valid 16-character Foundry id.`);
      }

      if (data._id !== undefined) {
        const expectedKey = `${FOLDER_KEY_PREFIX}${data._id}`;
        if (data._key !== expectedKey) {
          problems.push(`${label}: "_key" ("${data._key}") doesn't match its own "_id" (expected "${expectedKey}").`);
        }
      }

      continue;
    }

    for (const key of REQUIRED_KEYS) {
      if (!(key in data)) {
        problems.push(`${label}: missing required field "${key}".`);
      }
    }

    if (data.system !== undefined && (typeof data.system !== "object" || data.system === null || Array.isArray(data.system))) {
      problems.push(`${label}: "system" should be an object, got ${Array.isArray(data.system) ? "array" : typeof data.system}.`);
    }

    if (data._id !== undefined && !ID_PATTERN.test(data._id)) {
      problems.push(`${label}: "_id" ("${data._id}") isn't a valid 16-character Foundry id.`);
    }

    if (data.type !== undefined && validTypes && !validTypes.has(data.type)) {
      problems.push(`${label}: type "${data.type}" isn't a registered ${documentType} type in system.json.`);
    }

    if (data._key !== undefined && data._id !== undefined) {
      const expectedKey = `${expectedKeyPrefix}${data._id}`;
      if (data._key !== expectedKey) {
        problems.push(`${label}: "_key" ("${data._key}") doesn't match its own "_id" (expected "${expectedKey}").`);
      }
    }
  }
}

if (problems.length) {
  console.error(`Pack content check failed (${problems.length} problem(s) across ${filesChecked} files checked):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log(`Pack content check passed: ${filesChecked} source files are structurally sound.`);
