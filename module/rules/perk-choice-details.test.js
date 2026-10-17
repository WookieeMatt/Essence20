import fs from 'fs';

import { perkChoiceDetails } from './perk-choice-details.mjs';

/**
 * Perk choice P3 (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.5): the old picker's inputs are off the Perk Details tab; what
 * is left is a read-only legacy notice and the sub-Perk choice list (rules/perk-choice-details.mjs).
 */

const choiceSet = { type: 'ChoiceSet', key: 'skill', from: 'skill', legacy: 'system.choice' };
const subPerkTrigger = { type: 'Trigger', event: 'added', steps: [{ do: 'pickSubPerk', key: 'perks' }] };
const perk = ({ rules = [], ...system } = {}, flags = {}) => ({ flags, system: { rules, ...system } });
const labels = { skills: 'Skills', perks: 'Perks' };

describe('perkChoiceDetails', () => {
  test('a converted Perk: no legacy notice', () => {
    const details = perkChoiceDetails(perk({ rules: [choiceSet], hasChoice: false, choiceType: 'none' }), labels);
    expect(details.legacyChoice).toBeNull();
    expect(details.showSubPerkList).toBe(false);
  });

  test('a homebrew Perk still on the old picker: the notice, with its type label and stored pick', () => {
    const details = perkChoiceDetails(perk({ hasChoice: true, choiceType: 'skills', choice: 'athletics' }), labels);
    expect(details.legacyChoice).toEqual({ type: 'skills', typeLabel: 'Skills', value: 'athletics', converted: false });
  });

  test('nothing picked yet reads empty; an unknown type shows its key', () => {
    const details = perkChoiceDetails(perk({ hasChoice: true, choiceType: 'experiment', choice: '' }), labels);
    expect(details.legacyChoice).toMatchObject({ typeLabel: 'experiment', value: '' });
  });

  test('a converted copy the migration left unmatched (hasChoice still true): re-pick on the Rules tab', () => {
    const details = perkChoiceDetails(perk({ rules: [choiceSet], hasChoice: true, choiceType: 'skills', choice: 'oldSkill' }), labels);
    expect(details.legacyChoice).toMatchObject({ value: 'oldSkill', converted: true });
  });

  test('a list pick is joined', () => {
    const listSet = { ...choiceSet, count: 2 };
    const details = perkChoiceDetails(perk({ rules: [listSet], hasChoice: true, choiceType: 'skills' },
      { essence20: { rules: { choices: { skill: ['athletics', 'driving'] } } } }), labels);
    expect(details.legacyChoice.value).toBe('athletics, driving');
  });

  test('the sub-Perk list shows with a pickSubPerk rule, or on an old perks picker', () => {
    expect(perkChoiceDetails(perk({ rules: [subPerkTrigger] })).showSubPerkList).toBe(true);
    expect(perkChoiceDetails(perk({ hasChoice: true, choiceType: 'perks' })).showSubPerkList).toBe(true);
    expect(perkChoiceDetails(perk({ hasChoice: false, choiceType: 'perks' })).showSubPerkList).toBe(false);
    expect(perkChoiceDetails(perk()).showSubPerkList).toBe(false);
  });

  test('copes with no item', () => {
    expect(perkChoiceDetails(undefined)).toEqual({ legacyChoice: null, showSubPerkList: false });
  });
});

describe('Perk Details template (templates/item/details/perk.hbs)', () => {
  const template = fs.readFileSync('templates/item/details/perk.hbs', 'utf8');

  test.each(['hasChoice', 'choiceType', 'numChoices', 'choiceEssence', 'value', 'choice'])('no input for system.%s', field => {
    expect(template).not.toMatch(new RegExp(`name=["']system\\.${field}["']`));
  });

  test('the old labels are gone; the notice and the retitled sub-Perk list are there', () => {
    expect(template).not.toMatch(/E20\.Perk(HasChoice|ChoiceType|ChoiceQuantity)\b/);
    expect(template).not.toMatch(/perkChoiceTypes/);
    expect(template).toMatch(/perkChoice\.legacyChoice/);
    expect(template).toMatch(/perkChoice\.showSubPerkList/);
    expect(template).toMatch(/E20\.PerkSubPerkChoiceList/);
  });

  test('the keys it uses exist in lang/en.json; the removed ones are gone', () => {
    const lang = JSON.parse(fs.readFileSync('lang/en.json', 'utf8')).E20;
    for (const key of ['PerkLegacyChoice', 'PerkLegacyChoiceConvert', 'PerkLegacyChoiceRepick', 'PerkSubPerkChoiceList']) {
      expect(lang[key]).toEqual(expect.any(String));
    }

    for (const key of ['PerkHasChoice', 'PerkChoiceType', 'PerkChoiceQuantity', 'PerkNumChoices', 'PerkPlural']) {
      expect(lang[key]).toBeUndefined();
    }
  });

  test('the Hang-Up Details tab has no old picker inputs either', () => {
    const hangUp = fs.readFileSync('templates/item/details/hangUp.hbs', 'utf8');
    expect(hangUp).not.toMatch(/name=["']system\.(hasChoice|choiceType|choice)["']/);
  });
});
