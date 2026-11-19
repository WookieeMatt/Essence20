/**
 * A sheet input whose value an Active Effect changes shows the boosted total (Power Battery's +2 on Maximum Personal
 * Power: a base of 3 shows 5), but saves into the stored base. Foundry v14's ActorSheetV2 does nothing about it, so
 * every save of the sheet - any field, submitOnChange - wrote the 5 back as the base, and the effect added its +2 again:
 * 3, 5, 7, 9... (bug report 2026-10-12).
 *
 * For each submitted path an effect or a DerivedStat rule touched (actor.overrides, actor._ruleBoostPaths): unchanged from what was shown, nothing is written; typed
 * as a different number, the base moves by the same amount (typing 6 over a shown 5 makes the base 4, shown 6).
 * @param {Object} submitData   The expanded form data about to be saved (changed in place).
 * @param {Actor} actor
 * @returns {Object}            submitData
 */
export function keepEffectBoostsOutOfSource(submitData, actor) {
  // Item rules' DerivedStat numbers (rules/adapter.mjs#writeNumber) boost the shown value the same way, without an override.
  const boosted = new Set([...leafPaths(actor?.overrides ?? {}), ...(actor?._ruleBoostPaths ?? [])]);
  for (const path of boosted) {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((obj, key) => (obj && typeof obj == 'object' ? obj[key] : undefined), submitData);
    if (!parent || typeof parent != 'object' || !(last in parent)) {
      continue;
    }

    const typed = parent[last];
    const shown = valueAt(actor, path);
    const base = valueAt(actor._source, path);
    if (String(typed) === String(shown)) {
      delete parent[last];
    } else if ([typed, shown, base].every(value => value !== '' && value !== null && Number.isFinite(Number(value)))) {
      parent[last] = Number(base) + Number(typed) - Number(shown);
    }
  }

  return submitData;
}

const valueAt = (obj, path) => path.split('.').reduce((o, key) => (o == null ? undefined : o[key]), obj);

/** "a.b.c" for every non-object value in a nested object. */
function leafPaths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => (value && typeof value == 'object' && !Array.isArray(value)
    ? leafPaths(value, `${prefix}${key}.`)
    : [`${prefix}${key}`]));
}

/**
 * A number as the actor stores it, without what Active Effects and item rules add to the one shown. Advancement and
 * Essence trades add to the stored number; adding to the shown one wrote those bonuses in for good each time.
 * @param {Actor} actor
 * @param {String} path   e.g. "system.powers.personal.max"
 * @returns {Number}
 */
export function storedNumber(actor, path) {
  const stored = valueAt(actor?._source, path);
  return Number(stored ?? valueAt(actor, path)) || 0;
}
