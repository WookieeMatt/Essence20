/**
 * NPC and Companion Essences: a typed base under the worked-out score (user decision 2026-10-07).
 *
 * An NPC's Essences used to be a stored {max, value} pair that the sheet, the stat-block importer, rules and Active Effects
 * all wrote to, so a printed score and a boost stacked on it could not be told apart: a rule that raised Strength wrote
 * the new number over the printed one for good. Now, the same way Zords and Vehicles work (mechanics/vehicles/
 * machine-essences.mjs):
 *  - `base` is the printed score. The sheet and the importer edit it.
 *  - `max` is the score: the base, with Active Effects and item rules on top. Each prep starts it from the base
 *    (Essence20Actor#prepareBaseData), so effects and rules apply to it as before and never pile up.
 *  - `value` is the current amount, which Essence damage spends and a Rest restores. It is stored relative to the
 *    base: what shows is the stored value plus whatever the effects add to the score, so a boost does not look like
 *    damage and damage survives a boost ending. Writes to `value` and to `max` are turned back into the stored form
 *    (Essence20Actor#_preUpdate).
 * Player Characters keep their own model (Starting Essences' essenceBase).
 */

const KEYS = ['strength', 'speed', 'smarts', 'social'];
const TYPES = ['npc', 'companion'];

/** Whether an actor's Essences are a base, a worked-out score and a current amount. */
export function usesScoreBase(actor) {
  return TYPES.includes(actor?.type);
}

/**
 * migrateData: a stored record with no base takes its score as the base. Only a whole record (both max and value, not
 * a partial update - Foundry migrates those too), so an update that writes just `max` is not mistaken for an old record.
 * @param {Object} source
 * @param {Object} [options]
 * @returns {Boolean}   Whether anything moved
 */
export function migrateCreatureEssences(source, options = {}) {
  if (options?.partial) {
    return false;
  }

  let moved = false;
  for (const key of KEYS) {
    const essence = source?.essences?.[key];
    if (essence && typeof essence == 'object' && (essence.base === undefined || essence.base === null) && 'max' in essence && 'value' in essence) {
      essence.base = essence.max;
      moved = true;
    }
  }

  return moved;
}

/** prepareBaseData: start each score from its base, before Active Effects apply. */
export function resetScoresFromBase(system) {
  for (const key of KEYS) {
    const essence = system?.essences?.[key];
    if (essence && Number.isFinite(Number(essence.base))) {
      essence.max = Number(essence.base);
    }
  }
}

/** How much the effects and rules add to each score right now ({key: number}). */
export function scoreBoosts(actor) {
  const out = {};
  for (const key of KEYS) {
    const essence = actor?.system?.essences?.[key];
    const base = Number(actor?._source?.system?.essences?.[key]?.base ?? essence?.base);
    out[key] = Number.isFinite(base) && Number.isFinite(Number(essence?.max)) ? Number(essence.max) - base : 0;
  }

  return out;
}

/**
 * End of prepareDerivedData: the current amount shown is the stored one plus the boost, held between 0 and the score.
 * @param {Actor} actor
 */
export function finishCurrentEssences(actor) {
  const boosts = scoreBoosts(actor);
  for (const key of KEYS) {
    const essence = actor?.system?.essences?.[key];
    if (!essence) {
      continue;
    }

    const stored = Number(actor._source?.system?.essences?.[key]?.value ?? essence.value) || 0;
    const max = Number(essence.max) || 0;
    essence.value = Math.max(0, Math.min(max, stored + boosts[key]));
  }
}

/**
 * _preUpdate: turn a write in shown numbers into stored ones.
 *  - `max` with no `base`: the base moves by what the score moves (a rule raising Strength from 4 to 5 raises the base
 *    by 1), and the current amount moves with it.
 *  - `value` (Essence damage, healing, a Rest): stored as the written number less the boost.
 *  - `base` alone (the sheet): the current amount moves with it, so typing a new score keeps the damage taken.
 * @param {Actor} actor
 * @param {Object} changed   The (expanded) update data
 */
export function convertCreatureEssenceWrites(actor, changed) {
  const { getProperty, hasProperty, setProperty } = foundry.utils;
  const boosts = scoreBoosts(actor);
  for (const key of KEYS) {
    const path = field => `system.essences.${key}.${field}`;
    const stored = actor._source?.system?.essences?.[key] ?? {};
    const storedBase = Number(stored.base ?? stored.max) || 0;
    const storedValue = Number(stored.value) || 0;
    // The sheet sends every input on each save: a current amount equal to the one shown was not edited, so it is
    // treated as unwritten and moves with the base instead (raising the base keeps an undamaged NPC full).
    if (hasProperty(changed, path('value')) && hasProperty(changed, path('base'))
      && Number(getProperty(changed, path('value'))) == Number(actor.system?.essences?.[key]?.value)) {
      delete getProperty(changed, `system.essences.${key}`).value;
    }

    const wroteValue = hasProperty(changed, path('value'));

    if (hasProperty(changed, path('max')) && !hasProperty(changed, path('base'))) {
      const wanted = Number(getProperty(changed, path('max')));
      if (Number.isFinite(wanted)) {
        const shown = Number(actor.system?.essences?.[key]?.max) || 0;
        const delta = wanted - shown;
        setProperty(changed, path('base'), storedBase + delta);
        if (!wroteValue) {
          setProperty(changed, path('value'), storedValue + delta);
        }
      }
    } else if (hasProperty(changed, path('base')) && !wroteValue) {
      const wanted = Number(getProperty(changed, path('base')));
      if (Number.isFinite(wanted)) {
        setProperty(changed, path('value'), Math.max(0, storedValue + (wanted - storedBase)));
      }
    }

    // The stored max is only ever reset from the base each prep; keep it equal to the base so the record reads true.
    if (hasProperty(changed, path('base'))) {
      const base = Number(getProperty(changed, path('base')));
      if (Number.isFinite(base)) {
        setProperty(changed, path('max'), base);
      }
    }

    // A value the caller wrote is always a shown number (the sheet sends base and value together on every save; the
    // importer writes max and value); only the value set just above is already stored-form, and that one is not
    // caller-written.
    if (wroteValue) {
      const wanted = Number(getProperty(changed, path('value')));
      if (Number.isFinite(wanted)) {
        setProperty(changed, path('value'), Math.max(0, wanted - boosts[key]));
      }
    }
  }
}
