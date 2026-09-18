import { EFFECT_GROUPS, allKeys, parseKey } from "./effect-catalog.mjs";

/**
 * Cross-checks the effect catalog against the actor DataModels it claims to describe.
 *
 * The catalog (helpers/effect-catalog.mjs) is hand-authored on purpose - it has to run under
 * plain Node, and a schema walk cannot know which fields are *meant* to be targeted. The cost of
 * that choice is drift: rename a schema field and the catalog keeps cheerfully offering a key
 * that now resolves to nothing, which is the exact failure the catalog exists to prevent. This
 * puts a floor under that by checking both directions:
 *
 *  - every key the catalog offers resolves against at least one registered actor DataModel, and
 *  - every plain numeric/boolean field the schemas expose is either offered by the catalog or
 *    listed here as a deliberate omission.
 *
 * Developer tooling, not player-facing: run it from the console via
 * `game.essence20.auditEffectCatalog()`, or set `CONFIG.debug.essence20Catalog = true` before
 * the ready hook to have it run on load.
 */

/**
 * Schema roots the reverse check ignores outright. None of these are things an Active Effect
 * should be pointed at, and listing them here keeps the report short enough to actually read.
 */
const IGNORED_ROOTS = new Set([
  // Free-form id->record maps, not fields (see data/actor/templates/common.mjs).
  "actors", "items", "senses",
  // Sheet/display bookkeeping rather than character data.
  "isLocked", "showConditioning", "movementIsReadOnly", "movementNotSet", "isMorphed",
  "isTransformed", "canTransform", "canMorph", "canHaveZord", "canQualify", "canSpellcast",
  "canUseWeird", "canHover", "canShowWealthDie", "originEssencesIncrease", "originSkillsIncrease",
  "skillRankAllocation", "essenceAttribution", "essenceRanks", "level", "oldHandTransitionLevel",
]);

/**
 * Paths the reverse check ignores wherever they appear, rather than only at the root. These are
 * all per-entry bookkeeping that would otherwise bury the report - `essenceAttribution` and
 * `isChosen` alone account for 120 fields across the 24 skills, none of which an Active Effect
 * has any business touching.
 */
const IGNORED_PATH_PATTERNS = [
  // Skill Picker display + Essence-spend accounting (helpers/skill-picker.mjs).
  /^skills\.[^.]+\.(isChosen|essenceAttribution\.)/,
  // The Role's own skill die, set by the Role item rather than targeted directly.
  /^skills\.roleSkillDie\./,
  // Machine actors flag which stats come from their drivers (data/actor/templates/machine.mjs).
  /(^|\.)usesDrivers$/,
];

/**
 * Leaf field paths the catalog deliberately does not offer, with the reason. Anything here is
 * reported as "known omission" rather than a gap, so a real new gap stands out.
 */
const DELIBERATE_OMISSIONS = new Map([
  ["health.value", "current Health, changed by damage rather than by an effect"],
  ["conditioning", "a flat Strength-derived value, set in the Skill Picker"],
  // Only energon.normal has a maximum at all (the catalog offers that one); every pool's current
  // value is spent and regained in play rather than raised by an effect.
  ["energon.normal.value", "a spendable pool, not a persistent bonus"],
  ["energon.dark.value", "a spendable pool, not a persistent bonus"],
  ["energon.primal.value", "a spendable pool, not a persistent bonus"],
  ["energon.red.value", "a spendable pool, not a persistent bonus"],
  ["energon.synthEn.value", "a spendable pool, not a persistent bonus"],
  ["powers.personal.value", "a spendable pool, not a persistent bonus"],
  ["powers.sorcerous.value", "a spendable pool, not a persistent bonus"],
  ["powers.sorcerous.levelTaken", "character-build bookkeeping"],
]);

/**
 * Every leaf path under a SchemaField, as dot-delimited strings relative to the schema root.
 * @param {Object} schema  A SchemaField (or DataModel schema) exposing `fields`.
 * @param {String} [prefix]
 * @returns {Array<{path: String, type: String}>}
 */
export function collectLeafFields(schema, prefix = "") {
  const leaves = [];
  const fields = schema?.fields;
  if (!fields) {
    return leaves;
  }

  for (const [name, field] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name;

    if (field?.fields) {
      leaves.push(...collectLeafFields(field, path));
      continue;
    }

    const type = field?.constructor?.name ?? "Unknown";
    if (type === "NumberField" || type === "BooleanField") {
      leaves.push({ path, type });
    }
  }

  return leaves;
}

/**
 * The actor DataModels to check against, as {type: schema}.
 * @returns {Object}
 */
function registeredActorSchemas() {
  const models = globalThis.CONFIG?.Actor?.dataModels ?? {};

  return Object.fromEntries(
    Object.entries(models)
      .map(([type, model]) => [type, model?.schema])
      .filter(([, schema]) => !!schema),
  );
}

/**
 * Run the audit.
 * @param {Object} [options]
 * @param {Object} [options.schemas]  {type: schema}, defaulting to the registered actor models.
 *   Injectable so this is testable without a running Foundry.
 * @param {Boolean} [options.log]     Write the report to the console (default true).
 * @returns {{missingFields: Array, uncoveredFields: Array, knownOmissions: Array, checked: Number}}
 */
export function auditEffectCatalog({ schemas = registeredActorSchemas(), log = true } = {}) {
  const schemaEntries = Object.entries(schemas);
  const missingFields = [];

  // Forward: does every key the catalog offers actually exist somewhere?
  for (const key of allKeys()) {
    const entry = parseKey(key);
    if (entry?.property.readOnly) {
      // Computed fields are catalogued precisely so the validator can flag them; they still exist
      // in the schema, so they are checked like any other key.
    }

    const relative = key.replace(/^system\./, "");
    const foundOn = schemaEntries
      .filter(([, schema]) => !!schema.getField?.(relative))
      .map(([type]) => type);

    if (!foundOn.length) {
      missingFields.push({ key, groupId: entry?.groupId, propertyId: entry?.propertyId });
    }
  }

  // Reverse: which plain numeric/boolean fields does nothing in the catalog offer?
  const offered = new Set(allKeys().map(key => key.replace(/^system\./, "")));
  const seen = new Set();
  const uncoveredFields = [];
  const knownOmissions = [];

  for (const [type, schema] of schemaEntries) {
    for (const { path, type: fieldType } of collectLeafFields(schema)) {
      if (seen.has(path) || offered.has(path)) {
        continue;
      }

      seen.add(path);

      if (IGNORED_ROOTS.has(path.split(".")[0])) {
        continue;
      }

      if (IGNORED_PATH_PATTERNS.some(pattern => pattern.test(path))) {
        continue;
      }

      if (DELIBERATE_OMISSIONS.has(path)) {
        knownOmissions.push({ path, reason: DELIBERATE_OMISSIONS.get(path) });
        continue;
      }

      uncoveredFields.push({ path: `system.${path}`, fieldType, actorType: type });
    }
  }

  const report = {
    missingFields,
    uncoveredFields,
    knownOmissions,
    checked: allKeys().length,
  };

  if (log) {
    logReport(report, schemaEntries.length);
  }

  return report;
}

/**
 * @param {Object} report
 * @param {Number} schemaCount
 */
function logReport(report, schemaCount) {
  const { missingFields, uncoveredFields, checked } = report;
  console.group(`Essence20 | Effect catalog audit (${checked} keys, ${schemaCount} actor models)`);

  if (missingFields.length) {
    console.warn(
      `${missingFields.length} catalog key(s) resolve to no field on any actor - the schema moved `
      + "and the catalog did not:",
      missingFields,
    );
  } else {
    console.log("Every catalog key resolves against a real schema field.");
  }

  if (uncoveredFields.length) {
    console.info(
      `${uncoveredFields.length} numeric/boolean field(s) the catalog does not offer. Not `
      + "necessarily a bug - add to DELIBERATE_OMISSIONS if intentional:",
      uncoveredFields,
    );
  } else {
    console.log("Every numeric/boolean actor field is either offered or a known omission.");
  }

  console.groupEnd();
}

/**
 * Find catalog keys whose changes derived data silently throws away.
 *
 * The static audit above cannot see this: whether a field survives depends on what
 * prepareDerivedData does to it at runtime, not on the schema. A field that gets ASSIGNED there
 * (`system.x = ...`) discards any initial-phase change, so the effect looks perfectly healthy on
 * the sheet and does nothing - the same silent failure a misspelled key produces, which is the
 * whole thing this project exists to stop. Three keys were in that state when this was written:
 * energon.normal.max, health.max and powers.sorcerous.max.
 *
 * So: actually apply each numeric key to a throwaway actor and look. Destructive in the sense
 * that it creates and deletes an Actor, so it is manual developer tooling, never automatic -
 * `await game.essence20.probeClobberedKeys()`.
 * @param {Object} [options]
 * @param {String} [options.actorType]  Which actor type to probe against.
 * @param {Object} [options.system]     Extra system data for the probe actor (e.g. canTransform).
 * @param {Boolean} [options.log]
 * @returns {Promise<Array<Object>>} One entry per key the initial phase fails to change.
 */
export async function probeClobberedKeys({
  actorType = "playerCharacter",
  system = { canTransform: true },
  log = true,
} = {}) {
  const numericKeys = allKeys().filter(key => {
    const entry = parseKey(key);

    return ["int", "signedInt"].includes(entry?.property.widget);
  });

  // One key per distinct path shape is enough - probing all 24 skills' shiftUp tells us nothing
  // the first one didn't, and each probe is a document create/update round trip.
  const seen = new Set();
  const sample = numericKeys.filter(key => {
    const entry = parseKey(key);
    const shape = `${entry.groupId}.${entry.propertyId}.${entry.variant}`;
    if (seen.has(shape)) {
      return false;
    }

    seen.add(shape);

    return true;
  });

  const actor = await Actor.implementation.create({ name: "Catalog Probe", type: actorType, system });
  const [item] = await actor.createEmbeddedDocuments("Item", [{ name: "Catalog Probe", type: "perk" }]);
  const [effect] = await item.createEmbeddedDocuments("ActiveEffect", [{
    name: "Catalog Probe", transfer: true, system: { changes: [] },
  }]);

  const clobbered = [];

  try {
    for (const key of sample) {
      const entry = parseKey(key);
      const baseline = Number(foundry.utils.getProperty(actor, key)) || 0;

      await effect.update({ "system.changes": [{ key, type: "add", value: 2, phase: "initial" }] });
      const initial = Number(foundry.utils.getProperty(actor, key)) || 0;

      if (initial === baseline + 2) {
        continue;
      }

      await effect.update({ "system.changes": [{ key, type: "add", value: 2, phase: "final" }] });
      const final = Number(foundry.utils.getProperty(actor, key)) || 0;

      clobbered.push({
        key,
        groupId: entry.groupId,
        propertyId: entry.propertyId,
        baseline,
        initialPhase: initial,
        finalPhase: final,
        // A key already declared readOnly or already final-phase is a known, handled case.
        handled: !!entry.property.readOnly || entry.property.phase === "final",
        fixable: final === baseline + 2,
      });
    }
  } finally {
    await actor.delete();
  }

  if (log) {
    const unhandled = clobbered.filter(entry => !entry.handled);
    console.group(`Essence20 | Clobbered-key probe (${sample.length} key shapes, ${actorType})`);
    if (unhandled.length) {
      console.warn(
        `${unhandled.length} key(s) the catalog offers are discarded by derived data. Mark them `
        + "readOnly, or give the property phase: \"final\" where a late add is meaningful:",
        unhandled,
      );
    } else {
      console.log("Every offered numeric key survives derived data.");
    }

    const handled = clobbered.filter(entry => entry.handled);
    if (handled.length) {
      console.info(`${handled.length} known case(s), already readOnly or final-phase:`, handled);
    }

    console.groupEnd();
  }

  return clobbered;
}

/**
 * Groups whose properties are all missing their schema - a quick sanity read for a developer who
 * has just renamed something.
 * @param {Object} report  As returned by auditEffectCatalog.
 * @returns {Array<String>} Group ids where every offered key is missing.
 */
export function fullyBrokenGroups(report) {
  const broken = new Set(report.missingFields.map(entry => entry.groupId));

  return EFFECT_GROUPS
    .filter(group => broken.has(group.id))
    .filter(group => {
      const groupKeys = allKeys().filter(key => parseKey(key)?.groupId === group.id);

      return groupKeys.length
        && groupKeys.every(key => report.missingFields.some(entry => entry.key === key));
    })
    .map(group => group.id);
}
