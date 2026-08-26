#!/usr/bin/env node
/**
 * Verifies system.json's esmodules/styles/languages/packs entries actually exist on disk, and
 * (for packs specifically) that every source-content directory under packs/ on disk has a
 * matching system.json entry - catching drift in either direction: a manifest entry pointing at
 * a file that got renamed/deleted, or a pack/module added to disk but never wired into the
 * manifest (so Foundry silently never loads it). See docs/QA_PLAN.md's manifest-sync-check item.
 *
 * Usage: node scripts/check-manifest-sync.mjs
 * Exit code 0 if everything's in sync, 1 otherwise (suitable for a CI step).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf-8"));

const problems = [];

function checkFilesExist(label, paths) {
  for (const relativePath of paths ?? []) {
    if (!existsSync(join(ROOT, relativePath))) {
      problems.push(`${label} "${relativePath}" is listed in system.json but doesn't exist on disk.`);
    }
  }
}

checkFilesExist("esmodule", manifest.esmodules);
checkFilesExist("style", manifest.styles);
checkFilesExist("language file", (manifest.languages ?? []).map((entry) => entry.path));

// Packs: check each manifest entry's path exists and has a _source directory with content...
const manifestPackDirs = new Set();
for (const pack of manifest.packs ?? []) {
  const packPath = join(ROOT, pack.path);
  if (!existsSync(packPath) || !statSync(packPath).isDirectory()) {
    problems.push(`Pack "${pack.name}" points at "${pack.path}", which doesn't exist on disk.`);
    continue;
  }

  const sourcePath = join(packPath, "_source");
  if (!existsSync(sourcePath) || readdirSync(sourcePath).length === 0) {
    problems.push(`Pack "${pack.name}" ("${pack.path}") has no _source/*.json content to compile from.`);
  }

  manifestPackDirs.add(pack.path.replace(/^packs\//, ""));
}

// ...and conversely, every packs/* directory on disk should be a manifest entry, so a pack
// added to disk but never wired into system.json doesn't silently never load in Foundry.
const packsRoot = join(ROOT, "packs");
if (existsSync(packsRoot)) {
  for (const entry of readdirSync(packsRoot)) {
    const entryPath = join(packsRoot, entry);
    if (!statSync(entryPath).isDirectory()) {
      continue;
    }

    if (!manifestPackDirs.has(entry)) {
      problems.push(`"packs/${entry}" exists on disk but has no matching entry in system.json's "packs" list.`);
    }
  }
}

if (problems.length) {
  console.error(`Manifest sync check failed (${problems.length} problem(s)):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log("Manifest sync check passed: system.json matches what's on disk.");
