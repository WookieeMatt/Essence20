#!/usr/bin/env node
/**
 * Validates every item rule (system.rules) stored in packs/<pack>/_source/*.json against the rule
 * type catalogue (module/rules/types.mjs) - the same check the item sheet's Rules tab shows.
 * See docs/RULES_ENGINE_PLAN.md §7.
 *
 * Reported as errors (exit 1): anything validateRule() says is wrong - an unknown setting, a bad
 * formula, an unknown tag, a missing required setting.
 * Reported as warnings (exit 0): a rule type this version doesn't support yet. It's kept, never
 * stripped, so a pack written for a later version still loads; it just does nothing here.
 *
 * Usage: node scripts/check-rules.mjs [--verbose]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { validateRule } from "../module/rules/types.mjs";
import { unknownTags } from "../module/rules/predicate.mjs";
import "../module/rules/ext/index.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKS = join(ROOT, "packs");
const VERBOSE = process.argv.includes("--verbose");

const errors = [];
const warnings = [];
let itemsWithRules = 0;
let rulesScanned = 0;
let prerequisitesScanned = 0;

/** An item document and every item embedded in an actor document. */
function itemsOf(doc) {
  if (Array.isArray(doc.items)) {
    return [doc, ...doc.items];
  }

  return [doc];
}

for (const pack of readdirSync(PACKS, { withFileTypes: true })) {
  if (!pack.isDirectory()) {
    continue;
  }

  const source = join(PACKS, pack.name, "_source");
  if (!existsSync(source)) {
    continue;
  }

  for (const file of readdirSync(source).filter(name => name.endsWith(".json"))) {
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(source, file), "utf8"));
    } catch (error) {
      continue;
    }

    for (const item of itemsOf(doc)) {
      // Prerequisites (docs/PREREQUISITES_PLAN.md): the same tag language as rule conditions.
      const prerequisites = item?.system?.prerequisites;
      if (prerequisites?.when !== undefined) {
        prerequisitesScanned++;
        const place = `${pack.name}/${file}${item !== doc ? ` > ${item.name}` : ""}`;
        if (!Array.isArray(prerequisites.when)) {
          errors.push(`${place}: system.prerequisites.when must be a list`);
        } else {
          for (const tag of unknownTags(prerequisites.when)) {
            errors.push(`${place} prerequisites: unknown tag "${tag}"`);
          }
        }
      }

      const rules = item?.system?.rules;
      if (rules === undefined) {
        continue;
      }

      const where = `${pack.name}/${file}${item !== doc ? ` > ${item.name}` : ""}`;
      if (!Array.isArray(rules)) {
        errors.push(`${where}: system.rules must be a list`);
        continue;
      }

      if (rules.length) {
        itemsWithRules++;
      }

      rules.forEach((rule, index) => {
        rulesScanned++;
        for (const problem of validateRule(rule)) {
          const line = `${where} rule ${index} (${rule?.type ?? "?"}): ${problem}`;
          (/not supported yet/.test(problem) ? warnings : errors).push(line);
        }
      });
    }
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

for (const error of errors) {
  console.error(`error: ${error}`);
}

console.log(`Checked ${rulesScanned} rule(s) on ${itemsWithRules} item(s) and ${prerequisitesScanned} prerequisite list(s): ${errors.length} error(s), ${warnings.length} warning(s).`);
if (VERBOSE && !rulesScanned) {
  console.log("No pack item carries system.rules yet.");
}

process.exit(errors.length ? 1 : 0);
