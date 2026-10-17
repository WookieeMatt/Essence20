import { chosenList, chosenOf, hasAnyChoice, hasChosen, legacyChoiceOf, primaryChoiceKey } from './choice-read.mjs';

/**
 * rules/choice-read.mjs (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.1, phase 0): one way to read a pick - the rules choice,
 * then flags.essence20.legacyChoice (the 6.1 safety net), then the old system.choice.
 */

const item = ({ rules = [], choices, legacyChoice, choice } = {}) => ({
  flags: { essence20: { ...(choices ? { rules: { choices } } : {}), ...(legacyChoice !== undefined ? { legacyChoice } : {}) } },
  system: { rules, ...(choice !== undefined ? { choice } : {}) },
});

describe('primaryChoiceKey', () => {
  test('the ChoiceSet marked primary, else the first ChoiceSet', () => {
    const sets = [{ type: 'ChoiceSet', key: 'first' }, { type: 'ChoiceSet', key: 'main', primary: true }];
    expect(primaryChoiceKey(item({ rules: sets }))).toBe('main');
    expect(primaryChoiceKey(item({ rules: [{ type: 'ChoiceSet', key: 'only' }, { type: 'ChoiceSet', key: 'next' }] }))).toBe('only');
  });

  test('else the first pick / pickEach key in an added Trigger (nested steps too)', () => {
    const added = { type: 'Trigger', event: 'added', steps: [{ do: 'note' }, { do: 'branch', options: [{ steps: [{ do: 'pickEach', key: 'skills' }] }] }] };
    expect(primaryChoiceKey(item({ rules: [added] }))).toBe('skills');
    expect(primaryChoiceKey(item({ rules: [{ type: 'Trigger', event: 'added', steps: [{ do: 'pick', key: 'sense' }] }] }))).toBe('sense');
  });

  test('null when there is none: a pick in a Use rule or another Trigger, a pickGrant, a ChoiceSet without a key', () => {
    expect(primaryChoiceKey(item())).toBeNull();
    expect(primaryChoiceKey({})).toBeNull();
    expect(primaryChoiceKey(null)).toBeNull();
    expect(primaryChoiceKey(item({ rules: [{ type: 'Use', steps: [{ do: 'pick', key: 'skill' }] }] }))).toBeNull();
    expect(primaryChoiceKey(item({ rules: [{ type: 'Trigger', event: 'hit', steps: [{ do: 'pick', key: 'x' }] }] }))).toBeNull();
    expect(primaryChoiceKey(item({ rules: [{ type: 'Trigger', event: 'added', steps: [{ do: 'pickGrant', key: 'chosen' }] }] }))).toBeNull();
    expect(primaryChoiceKey(item({ rules: [{ type: 'ChoiceSet' }] }))).toBeNull();
    expect(primaryChoiceKey({ system: { rules: 'not a list' } })).toBeNull();
  });
});

describe('chosenOf precedence', () => {
  const set = [{ type: 'ChoiceSet', key: 'element' }];

  test('the rules choice wins over the legacy flag and system.choice', () => {
    expect(chosenOf(item({ rules: set, choices: { element: 'fire' }, legacyChoice: 'cold', choice: 'acid' }))).toBe('fire');
  });

  test('then the 6.1 legacy flag, then system.choice', () => {
    expect(chosenOf(item({ rules: set, legacyChoice: 'cold', choice: 'acid' }))).toBe('cold');
    expect(chosenOf(item({ rules: set, choice: 'acid' }))).toBe('acid');
  });

  test('an unmade rules choice (undefined / null / "" / []) falls through', () => {
    for (const element of [undefined, null, '', []]) {
      expect(chosenOf(item({ rules: set, choices: { element }, choice: 'acid' }))).toBe('acid');
    }

    expect(chosenOf(item({ rules: set, choices: { element: 'fire' }, legacyChoice: '', choice: 'acid' }))).toBe('fire');
    expect(chosenOf(item({ legacyChoice: '', choice: 'acid' }))).toBe('acid');
    expect(chosenOf(item({ legacyChoice: null, choice: 'acid' }))).toBe('acid');
  });

  test('an explicit key reads that key; null / no key skips the rules choice', () => {
    const both = item({ rules: set, choices: { element: 'fire', weapon: 'abc' }, choice: 'acid' });
    expect(chosenOf(both, 'weapon')).toBe('abc');
    expect(chosenOf(both, 'missing')).toBe('acid');
    expect(chosenOf(both, null)).toBe('acid');
    // A choice stored under a key the item has no ChoiceSet for is not its primary pick.
    expect(chosenOf(item({ choices: { element: 'fire' }, choice: 'acid' }))).toBe('acid');
  });

  test('a legacy-only item reads exactly what item.system.choice held, empty values included', () => {
    for (const choice of ['ground', 'none', '', null, undefined, 'skill::Name']) {
      const legacy = item({ choice });
      expect(chosenOf(legacy)).toBe(legacy.system.choice);
      expect(legacyChoiceOf(legacy)).toBe(legacy.system.choice);
    }

    expect(chosenOf({})).toBeUndefined();
    expect(chosenOf(undefined)).toBeUndefined();
    expect(chosenOf(null)).toBeUndefined();
    expect(chosenOf({ system: {} })).toBeUndefined();
  });
});

describe('legacyChoiceOf', () => {
  test('never the rules choice: the legacy flag, else system.choice as stored', () => {
    const converted = item({ rules: [{ type: 'ChoiceSet', key: 'skill' }], choices: { skill: 'athletics' }, choice: 'stealth' });
    expect(legacyChoiceOf(converted)).toBe('stealth');
    expect(legacyChoiceOf(item({ legacyChoice: 'cold', choice: 'acid' }))).toBe('cold');
    expect(legacyChoiceOf(item({ legacyChoice: ['a'], choice: 'acid' }))).toEqual(['a']);
    expect(legacyChoiceOf(item({ legacyChoice: [], choice: 'acid' }))).toBe('acid');
    expect(legacyChoiceOf(undefined)).toBeUndefined();
  });
});

describe('list picks (multi-Skill Perks hold one list - user decision 2026-10-07)', () => {
  const skills = [{ type: 'ChoiceSet', key: 'skill', count: 2 }];

  test('chosenOf hands the list back as stored; chosenList drops empty entries', () => {
    const multi = item({ rules: skills, choices: { skill: ['athletics', '', 'stealth', null] } });
    expect(chosenOf(multi)).toEqual(['athletics', '', 'stealth', null]);
    expect(chosenList(multi)).toEqual(['athletics', 'stealth']);
  });

  test('chosenList wraps a single pick and gives [] for none', () => {
    expect(chosenList(item({ choice: 'athletics' }))).toEqual(['athletics']);
    expect(chosenList(item({ rules: skills, choices: { skill: 'stealth' } }))).toEqual(['stealth']);
    expect(chosenList(item({ choice: '' }))).toEqual([]);
    expect(chosenList(item())).toEqual([]);
    expect(chosenList(undefined)).toEqual([]);
    // A list of only empty entries is no pick: the old field shows through.
    expect(chosenList(item({ rules: skills, choices: { skill: ['', null] }, choice: 'brawn' }))).toEqual(['brawn']);
  });

  test('hasChosen: one value, or any entry of a list, compared loosely', () => {
    const multi = item({ rules: skills, choices: { skill: ['athletics', 'stealth'] } });
    expect(hasChosen(multi, 'stealth')).toBe(true);
    expect(hasChosen(multi, 'brawn')).toBe(false);
    expect(hasChosen(item({ choice: 'ground' }), 'ground')).toBe(true);
    expect(hasChosen(item({ choice: '2' }), 2)).toBe(true);
    expect(hasChosen(item({ choice: 'ground' }), 'aerial')).toBe(false);
  });

  test('hasChosen is false for an empty value or no pick (never "undefined == undefined")', () => {
    expect(hasChosen(item(), undefined)).toBe(false);
    expect(hasChosen(item({ choice: '' }), '')).toBe(false);
    expect(hasChosen(item({ choice: 'ground' }), null)).toBe(false);
    expect(hasChosen(undefined, 'ground')).toBe(false);
  });

  test('hasAnyChoice', () => {
    expect(hasAnyChoice(item({ choice: 'science' }))).toBe(true);
    expect(hasAnyChoice(item({ choice: '' }))).toBe(false);
    expect(hasAnyChoice(item())).toBe(false);
    expect(hasAnyChoice(item({ rules: skills, choices: { skill: ['athletics'] } }))).toBe(true);
    expect(hasAnyChoice(item({ rules: skills, choices: { skill: [] } }))).toBe(false);
  });
});
