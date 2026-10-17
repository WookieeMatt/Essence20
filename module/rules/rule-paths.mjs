/**
 * Path-keyed rule fields, kept as dotted paths.
 *
 * Rules spell writes as dotted paths ({"set": {"flags.essence20.ninjaPowerActive": true}}), but Foundry expands dotted
 * keys when it stores a document, so a live item carries {"set": {"flags": {"essence20": {...}}}} instead. Every reader
 * of these fields walks them as `Object.entries(...)` of paths, so the expanded form wrote nothing (found in the live test
 * 2026-10-07; the unit tests read the raw pack JSON and never saw it). Item#prepareDerivedData runs each rule through
 * `flatRulePaths`, so readers always get dotted paths again. `system` is paths only on the grant / pickGrant steps (each
 * key is set on the copy); elsewhere (item data a step creates, a companion's data) it stays nested on purpose.
 */

/** The fields whose keys are paths. */
export const PATH_KEYED = ['set', 'add', 'ladder', 'multiply', 'atLeast', 'defaults', 'changes', 'formulas'];

/** Steps whose `system` is path-keyed too. */
export const SYSTEM_PATH_STEPS = ['grant', 'pickGrant'];

const isPlain = value => !!value && typeof value == 'object' && !Array.isArray(value);

/** {a: {b: 1}} -> {"a.b": 1}; arrays and plain values are leaves. */
export function flattenPaths(source, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(source ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlain(value)) {
      flattenPaths(value, path, out);
    } else {
      out[path] = value;
    }
  }

  return out;
}

/** A copy of a rule (or any part of one) with every path-keyed field flattened, at any depth; the input is untouched. */
export function flatRulePaths(value) {
  if (Array.isArray(value)) {
    return value.map(flatRulePaths);
  }

  if (!isPlain(value)) {
    return value;
  }

  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const paths = PATH_KEYED.includes(key) || (key == 'system' && SYSTEM_PATH_STEPS.includes(value.do));
    out[key] = paths && isPlain(inner) ? flattenPaths(inner) : key == 'system' ? inner : flatRulePaths(inner);
  }

  return out;
}
