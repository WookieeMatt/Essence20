#!/usr/bin/env node
/**
 * Verifies the release workflow's zip list ships every top-level folder/file the system reaches
 * for at runtime. .github/workflows/github-actions-release.yml builds Essence20.zip from a
 * hand-written list, so a folder left off it works in a dev checkout (which has everything) and
 * only 404s on a release install - which is how lib/ (the vendored pdf.js the PDF importers load)
 * and tours/ went missing.
 *
 * "Reached for at runtime" means, starting from what the zip ships:
 *   - system.json's esmodules/styles/languages/packs paths;
 *   - any "systems/essence20/<entry>/..." path in a shipped file (templates, icons, lib, tours...);
 *   - any relative import or CSS url() in a shipped file that resolves outside its own folder.
 * Everything referenced must be on the list, and everything on the list must exist.
 *
 * Usage: node scripts/check-release-zip.mjs
 * Exit code 0 if the zip list covers everything, 1 otherwise (suitable for a CI step).
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, posix } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKFLOW = ".github/workflows/github-actions-release.yml";
const SCANNED_EXTENSIONS = new Set([".mjs", ".js", ".hbs", ".html", ".json", ".css"]);

const problems = [];

/* ------------------------------------------------------------ the zip list */

// The entries are the backslash-continued lines after `zip --recurse-paths <archive>`, up to the
// first line that doesn't continue.
function readZipList() {
  const lines = readFileSync(join(ROOT, WORKFLOW), "utf-8").split(/\r?\n/);
  const start = lines.findIndex(line => /\bzip\s+--recurse-paths\b/.test(line));
  if (start < 0) {
    return null;
  }

  const entries = [];
  let continues = /\\\s*$/.test(lines[start]);
  for (let i = start + 1; continues && i < lines.length; i++) {
    const token = lines[i].replace(/\\\s*$/, "").trim();
    if (token) {
      entries.push(token.replace(/\/+$/, ""));
    }

    continues = /\\\s*$/.test(lines[i]);
  }

  return entries;
}

const zipList = readZipList();
if (!zipList?.length) {
  console.error(`Release zip check failed: couldn't find the \`zip --recurse-paths\` list in ${WORKFLOW}.`);
  process.exit(1);
}

const shipped = new Set(zipList);

for (const entry of zipList) {
  if (!existsSync(join(ROOT, entry))) {
    problems.push(`"${entry}" is in the release zip list but doesn't exist in the repo.`);
  }
}

/* ------------------------------------------------------------ what's referenced */

// First place each top-level entry was seen referenced, for the error message.
const required = new Map();
function requireEntry(relativePath, where) {
  const entry = relativePath.replace(/^\.?\//, "").split("/")[0];
  if (entry && !entry.startsWith("..") && !required.has(entry)) {
    required.set(entry, where);
  }
}

requireEntry("system.json", "the system itself");

const manifest = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf-8"));
for (const path of manifest.esmodules ?? []) requireEntry(path, "system.json esmodules");
for (const path of manifest.styles ?? []) requireEntry(path, "system.json styles");
for (const { path } of manifest.languages ?? []) requireEntry(path, "system.json languages");
for (const { path } of manifest.packs ?? []) requireEntry(path, "system.json packs");

function* walk(relativeDir) {
  for (const dirent of readdirSync(join(ROOT, relativeDir), { withFileTypes: true })) {
    const path = posix.join(relativeDir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walk(path);
    } else {
      yield path;
    }
  }
}

function* shippedTextFiles() {
  for (const entry of zipList) {
    const absolute = join(ROOT, entry);
    if (!existsSync(absolute)) {
      continue;
    }

    const files = statSync(absolute).isDirectory() ? walk(entry) : [entry];
    for (const file of files) {
      const extension = posix.extname(file);
      // Jest specs ride along inside module/ but never run in Foundry, and their paths can be fakes.
      if (SCANNED_EXTENSIONS.has(extension) && !/\.test\.m?js$/.test(file)) {
        yield file;
      }
    }
  }
}

const SYSTEM_PATH = /systems\/essence20\/([^/"'`\s)]+)\//g;
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
const RELATIVE_URL = /url\(\s*["']?(\.{1,2}\/[^"')]+)/g;

for (const file of shippedTextFiles()) {
  const text = readFileSync(join(ROOT, file), "utf-8");
  const lineOf = (index) => text.slice(0, index).split("\n").length;

  for (const match of text.matchAll(SYSTEM_PATH)) {
    // A template-literal segment (`systems/essence20/${dir}/...`) can't be checked statically.
    if (!match[1].includes("${")) {
      requireEntry(match[1], `${file}:${lineOf(match.index)}`);
    }
  }

  const extension = posix.extname(file);
  const relativePattern = extension === ".css" ? RELATIVE_URL : (extension === ".mjs" || extension === ".js") ? RELATIVE_IMPORT : null;
  for (const match of relativePattern ? text.matchAll(relativePattern) : []) {
    const target = posix.normalize(posix.join(posix.dirname(file), match[1]));
    requireEntry(target, `${file}:${lineOf(match.index)}`);
  }
}

for (const [entry, where] of required) {
  if (!shipped.has(entry)) {
    const onDisk = existsSync(join(ROOT, entry)) ? "" : " (and it isn't in the repo either)";
    problems.push(`"${entry}" is loaded at runtime (first seen: ${where}) but isn't in the release zip list${onDisk}.`);
  }
}

if (problems.length) {
  console.error(`Release zip check failed (${problems.length} problem(s)) - see ${WORKFLOW}:`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }

  process.exit(1);
}

console.log(`Release zip check passed: the zip list (${zipList.join(", ")}) covers everything the system loads.`);
