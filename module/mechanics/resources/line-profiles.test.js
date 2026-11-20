import fs from 'node:fs';
import { BOOK_PROFILES, LINE_RULES, normalizeLineRules, profileRule } from './line-profiles.mjs';

test('every book profile only sets known switches, with values of the right kind', () => {
  for (const profile of Object.values(BOOK_PROFILES)) {
    for (const [key, value] of Object.entries(profile)) {
      expect(LINE_RULES[key]).toBeDefined();
      expect(normalizeLineRules({ [key]: value })[key]).toEqual(value);
    }
  }
});

test('the book lines keep the answers the code hard-coded before the profiles', () => {
  expect(profileRule('powerRangers', 'canMorph')).toBe(true);
  expect(profileRule('giJoe', 'canMorph')).toBe(false);
  expect(profileRule('myLittlePony', 'canSpellcast')).toBe(true);
  expect(profileRule('giJoe', 'canQualify')).toBe(true);
  expect(profileRule('powerRangers', 'gridPower')).toBe(true);
  expect(profileRule('myLittlePony', 'gmStoryPool')).toBe(false);
  expect(profileRule('', 'gmStoryPool')).toBe(true);
  for (const line of ['powerRangers', 'myLittlePony']) {
    expect(profileRule(line, 'defenseBoostAfterRoll')).toBe(false);
  }

  expect(profileRule('transformers', 'defenseBoostAfterRoll')).toBe(true);
  expect(profileRule('myLittlePony', 'defenseBoostLastsScene')).toBe(true);
  expect(profileRule('myLittlePony', 'requisition')).toBe(false);
  expect(profileRule('powerRangers', 'megaformSubtype')).toBe('megaformZord');
  expect(profileRule('transformers', 'megaformSubtype')).toBe('megaformCombiner');
  expect(profileRule('myLittlePony', 'threatRuleset')).toBe('canterlot');
  expect(profileRule('powerRangers', 'threatRuleset')).toBe('fieldGuide');
  expect(profileRule('welcomeToNightVale', 'startingEssenceMax')).toBe(8);
  expect(profileRule('giJoe', 'startingEssenceMax')).toBe(15);
  expect(profileRule('', 'grappleEscapeSkills')).toEqual([]);
});

test('overrides win, and an unknown switch has no value', () => {
  expect(profileRule('myLittlePony', 'requisition', { requisition: true })).toBe(true);
  expect(profileRule('powerRangers', 'canMorph', { canMorph: false })).toBe(false);
  expect(profileRule('giJoe', 'nope')).toBeUndefined();
});

test('stored switches are tidied: wrong kinds and unknown keys are dropped', () => {
  expect(normalizeLineRules({
    canMorph: 'true', requisition: false, megaformSubtype: 'megaformDragon', threatRuleset: 'finster',
    startingEssenceMax: '0', grappleEscapeSkills: 'might, might , athletics', bogus: 1,
  })).toEqual({ requisition: false, threatRuleset: 'finster', grappleEscapeSkills: ['might', 'athletics'] });
  expect(normalizeLineRules({ startingEssenceMax: 12.7 })).toEqual({ startingEssenceMax: 12 });
  expect(normalizeLineRules(null)).toEqual({});
});

test('every switch has a label and a hint, and every choice a name', () => {
  const lang = JSON.parse(fs.readFileSync('lang/en.json', 'utf8')).E20;
  for (const [key, spec] of Object.entries(LINE_RULES)) {
    expect(lang.LineRule[key]).toBeTruthy();
    expect(lang.LineRuleHint[key]).toBeTruthy();
    for (const choice of spec.choices ?? []) {
      expect(lang.LineRuleChoice[key][choice]).toBeTruthy();
    }
  }
});

test('a list from fixed choices keeps only those choices', () => {
  expect(normalizeLineRules({ megaformJoinTypes: ['zord', 'dragon', 'npc'] })).toEqual({ megaformJoinTypes: ['zord', 'npc'] });
  expect(normalizeLineRules({ megaformJoinTypes: ['dragon'] })).toEqual({});
});
