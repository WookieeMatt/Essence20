/**
 * One way to read an item's pick (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.1, phase 0).
 *
 * A pick can live in three places, read in this order:
 *  1. the rules choice, flags.essence20.rules.choices[key] (a ChoiceSet or a `pick` step);
 *  2. flags.essence20.legacyChoice, the 6.1 safety net (Essence20Item.migrateData copies system.choice there before the
 *     schema drops the field - plan §2.6);
 *  3. the old Perk / Hang-Up picker's system.choice (removed in 6.1).
 *
 * The key defaults to the item's primary pick (primaryChoiceKey). An item with no ChoiceSet and no added-Trigger pick
 * has no key, so it reads straight from 2 and 3 - exactly what the old `item.system.choice` readers saw.
 *
 * A pick may be a list (a multi-Skill Perk holds every Skill in one array - user decision 2026-10-07): chosenOf hands the
 * stored value back as it is, chosenList always gives an array, hasChosen asks whether one value is in it.
 *
 * Plain Node safe: no imports, no Foundry globals.
 */

/** Whether a stored pick counts as made: not undefined / null / '' / an empty list. */
function isMade(value) {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  return !Array.isArray(value) || value.some(isMade);
}

/** The rule list on an item, as stored. */
function rulesOfItem(item) {
  const rules = item?.system?.rules;
  return Array.isArray(rules) ? rules : [];
}

/** The first `pick` / `pickEach` key in a step list (nested steps too). */
function firstPickKey(steps) {
  for (const step of Array.isArray(steps) ? steps : []) {
    if ((step?.do == 'pick' || step?.do == 'pickEach') && step.key) {
      return step.key;
    }

    const nested = [step?.steps, step?.onSuccess, step?.onFail, step?.onCrit, ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])];
    for (const list of nested) {
      const key = firstPickKey(list);
      if (key) {
        return key;
      }
    }
  }

  return null;
}

/**
 * The key of an item's main pick: its ChoiceSet marked `primary: true`, else its first ChoiceSet, else the first `pick` /
 * `pickEach` key in an `added` Trigger. Null when the item has none.
 * @param {Item|Object} item
 * @returns {String|null}
 */
export function primaryChoiceKey(item) {
  const rules = rulesOfItem(item);
  const sets = rules.filter(rule => rule?.type == 'ChoiceSet' && rule.key);
  const primary = sets.find(rule => rule.primary === true) ?? sets[0];
  if (primary) {
    return primary.key;
  }

  for (const rule of rules) {
    if (rule?.type == 'Trigger' && rule.event == 'added') {
      const key = firstPickKey(rule.steps);
      if (key) {
        return key;
      }
    }
  }

  return null;
}

/**
 * The old picker's value only: flags.essence20.legacyChoice, else system.choice as stored ('' and undefined included,
 * so a reader switched to this sees exactly what it saw before). For the readers that reshape an old pick
 * (rules/legacy-choices.mjs) and must not see the rules choice.
 * @param {Item|Object} item
 * @returns {*}
 */
export function legacyChoiceOf(item) {
  const flagged = item?.flags?.essence20?.legacyChoice;
  return isMade(flagged) ? flagged : item?.system?.choice;
}

/**
 * An item's pick: the rules choice under `key`, else the 6.1 legacy flag, else system.choice (as stored).
 * @param {Item|Object} item
 * @param {String|null} [key]   Defaults to primaryChoiceKey(item).
 * @returns {*}   A value, a list, or whatever system.choice holds ('' / undefined when nothing was picked).
 */
export function chosenOf(item, key = primaryChoiceKey(item)) {
  if (key) {
    const chosen = choiceValue(item, key);
    if (isMade(chosen)) {
      return chosen;
    }
  }

  return legacyChoiceOf(item);
}

/**
 * An item's pick as a list: [] when nothing was picked, [value] for a single pick, the entries of a list pick (empty
 * entries dropped).
 * @param {Item|Object} item
 * @param {String|null} [key]
 * @returns {Array}
 */
export function chosenList(item, key = primaryChoiceKey(item)) {
  const chosen = chosenOf(item, key);
  if (Array.isArray(chosen)) {
    return chosen.filter(isMade);
  }

  return isMade(chosen) ? [chosen] : [];
}

/**
 * Whether an item's pick is (or, for a list, includes) this value. Compared loosely (`==`), as the old readers did.
 * @param {Item|Object} item
 * @param {*} value
 * @param {String|null} [key]
 * @returns {Boolean}
 */
export function hasChosen(item, value, key = primaryChoiceKey(item)) {
  if (!isMade(value)) {
    return false;
  }

  return chosenList(item, key).some(entry => entry == value);
}

/** Whether an item has any pick made. */
export function hasAnyChoice(item, key = primaryChoiceKey(item)) {
  return chosenList(item, key).length > 0;
}

/** Every step in a step list, nested ones too. */
function stepsIn(steps, out = []) {
  for (const step of Array.isArray(steps) ? steps : []) {
    out.push(step);
    for (const nested of [step?.steps, step?.onSuccess, step?.onFail, step?.onCrit, ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])]) {
      stepsIn(nested, out);
    }
  }

  return out;
}

/**
 * The rule (a ChoiceSet) or step (a `pick` / recording step) that keeps an item's pick under `key` and carries the old
 * Perk picker's pick over (`legacy: "system.choice"` - Perk choice P2), or null.
 * @param {Item|Object} item
 * @param {String} key
 * @returns {Object|null}
 */
export function legacyChoiceRule(item, key) {
  for (const rule of rulesOfItem(item)) {
    if (rule?.type == 'ChoiceSet' && rule.key == key && rule.legacy == 'system.choice' && !rule.disabled) {
      return rule;
    }

    const step = stepsIn(rule?.steps).find(one => one?.key == key && one.legacy == 'system.choice');
    if (step) {
      return step;
    }
  }

  return null;
}

/**
 * The value a `{choice.<key>}` / `rule:choiceHas:<key>` reads (Perk choice P2): the rules choice under `key`; while that
 * isn't made yet, an item converted from the old Perk picker (its ChoiceSet carries `legacy: "system.choice"`) reads its
 * old pick - so a character's copy keeps working before the world migration has copied the pick over (or when the old
 * value matched no option and was left alone). A list ChoiceSet (`count`) gets an old single pick as a one-entry list.
 * Anything else: the stored value as it is (undefined when there is none).
 * @param {Item|Object} item
 * @param {String} key
 * @returns {*}
 */
export function choiceValue(item, key) {
  const chosen = item?.flags?.essence20?.rules?.choices?.[key];
  if (isMade(chosen) || !key) {
    return chosen;
  }

  const rule = legacyChoiceRule(item, key);
  const old = rule ? legacyChoiceOf(item) : undefined;
  if (!isMade(old)) {
    return chosen;
  }

  const listed = rule.count !== undefined && rule.count !== null && rule.count !== '';
  return listed && !Array.isArray(old) ? [old] : old;
}

/** A pick as one value: a list's first made entry, else the value itself ('' / null / undefined stay as they are). */
export function firstChosen(value) {
  return Array.isArray(value) ? value.find(isMade) : value;
}
