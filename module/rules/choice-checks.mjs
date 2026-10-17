/**
 * Static checks for the Perk choice migration (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.2.6, Perk choice P1), run over every
 * pack item by scripts/check-rules.mjs:
 *  - an item never has both the old Perk / Hang-Up picker (system.hasChoice) and a rules pick (a ChoiceSet, or a pick /
 *    pickEach / pickSubPerk step in an `added` Trigger) - it would ask twice;
 *  - a converted item (a ChoiceSet with legacy "system.choice", or a pickSubPerk) no longer reads the old pick in its rule
 *    text (`system.choice`, `{item.choice}`) - the tags move to rule:choiceHas / {choice.<key>} in the same edit;
 *  - a ChoiceSet carrying an old pick over (legacy "system.choice") offers a fixed list of values (not typed text or the
 *    actor's own items), so the world migration can match the old value against it.
 * Plain Node safe: no imports.
 */

/** Sources whose values don't depend on what the actor owns or types (notHeld / held only narrow what is offered). */
export const STABLE_CHOICE_SOURCES = ['skill', 'essence', 'defense', 'list', 'config', 'sense', 'environment', 'movement', 'damageType', 'element'];

const PICK_STEPS = ['pick', 'pickEach', 'pickSubPerk'];

/** Every step in a step list, nested ones too. */
function stepsIn(steps) {
  const all = [];
  for (const step of Array.isArray(steps) ? steps : []) {
    all.push(step);
    for (const nested of [step?.steps, step?.onSuccess, step?.onFail, step?.onCrit, step?.then, ...(Array.isArray(step?.options) ? step.options.map(o => o?.steps) : [])]) {
      all.push(...stepsIn(nested));
    }
  }

  return all;
}

/** A rule's JSON with its own `legacy` settings left out (they name the old path on purpose). */
function textWithoutLegacy(rule) {
  return JSON.stringify(rule, (key, value) => (key == 'legacy' ? undefined : value));
}

/** An item's rules picks: its ChoiceSets, and the pick / pickEach / pickSubPerk steps of its `added` Triggers. */
function rulesPicks(item) {
  const rules = Array.isArray(item?.system?.rules) ? item.system.rules : [];
  return {
    sets: rules.filter(rule => rule?.type == 'ChoiceSet' && !rule.disabled),
    addedPicks: rules.filter(rule => rule?.type == 'Trigger' && rule.event == 'added' && !rule.disabled)
      .flatMap(rule => stepsIn(rule.steps)).filter(step => PICK_STEPS.includes(step?.do)),
  };
}

/**
 * Whether an item asks its pick through its rules (a ChoiceSet, or a pick step in an `added` Trigger) - the drop handlers
 * then leave the old Perk / Hang-Up picker out, whatever the copy's old hasChoice says (a world copy made before the
 * conversion keeps hasChoice: true until migrated). Exactly one dialog per pick (Perk choice P2).
 * @param {Object} item   Item data or a document (its prepared rules - a copy's are its original's).
 * @returns {Boolean}
 */
export function hasRulesPick(item) {
  const { sets, addedPicks } = rulesPicks(item);
  return sets.length > 0 || addedPicks.length > 0;
}

/** Whether an item's rules pick its sub-Perks (a pickSubPerk step): its system.items is that list, not a grant. */
export function hasSubPerkPick(item) {
  return rulesPicks(item).addedPicks.some(step => step.do == 'pickSubPerk');
}

/**
 * Everything wrong with one item's Perk choice set-up.
 * @param {Object} item   Item data (pack JSON or a document).
 * @returns {Array<String>}
 */
export function perkChoiceProblems(item) {
  const rules = Array.isArray(item?.system?.rules) ? item.system.rules : [];
  const { sets, addedPicks } = rulesPicks(item);
  const problems = [];

  if (item?.system?.hasChoice === true && (sets.length || addedPicks.length)) {
    problems.push('has both the old picker (hasChoice) and a rules pick - it would ask twice');
  }

  const carried = sets.filter(rule => rule.legacy == 'system.choice');
  const converted = carried.length || addedPicks.some(step => step.do == 'pickSubPerk');
  if (converted) {
    // Perk choice P2: the old picker's settings go in the same edit (choiceType none; UniqueChoice / AnyGeneralPerkChoice
    // are excludeCopies / pickSubPerk anyGeneral now).
    if (item?.system?.choiceType && item.system.choiceType != 'none') {
      problems.push(`converted but choiceType is still "${item.system.choiceType}" - set it to "none"`);
    }

    for (const rule of rules.filter(one => ['UniqueChoice', 'AnyGeneralPerkChoice'].includes(one?.type))) {
      problems.push(`converted but still has a ${rule.type} rule (the old picker's) - use excludeCopies / pickSubPerk anyGeneral`);
    }

    rules.forEach((rule, index) => {
      const text = textWithoutLegacy(rule);
      if (text.includes('system.choice') || text.includes('{item.choice}')) {
        problems.push(`rule ${index} (${rule?.type ?? '?'}) still reads the old pick (system.choice / {item.choice}) - use rule:choiceHas / {choice.<key>}`);
      }
    });
  }

  for (const rule of carried) {
    if (!STABLE_CHOICE_SOURCES.includes(rule.from)) {
      problems.push(`ChoiceSet "${rule.key}" carries system.choice over but from: ${rule.from ?? '?'} has no fixed list of values`);
    }
  }

  return problems;
}
