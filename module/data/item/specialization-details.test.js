import fs from 'node:fs';

import { E20 } from '../../util/config.mjs';

/**
 * The Specialization item's Details tab (templates/item/details/specialization.hbs, 2026-10-07): it used to be
 * an empty <div>, so a Specialization's skill, shift and isSpecialized couldn't be edited on its sheet.
 */
describe('Specialization Details template', () => {
  const template = fs.readFileSync('templates/item/details/specialization.hbs', 'utf8');

  test('the skill is a select over CONFIG skills', () => {
    expect(template).toMatch(/<select[^>]*name="system\.skill"[^>]*>\s*\{\{selectOptions config\.skills selected=system\.skill\}\}/);
  });

  test('the shift is a select over the skill shift list (as a value: label object, so the option values are shifts)', () => {
    expect(template).toMatch(/<select[^>]*name="system\.shift"[^>]*>\s*\{\{selectOptions config\.skillShifts selected=system\.shift\}\}/);
    // The schema's choices (skillShiftList) and the select's options are the same shifts.
    expect(Object.keys(E20.skillShifts).sort()).toEqual([...E20.skillShiftList].sort());
  });

  test('isSpecialized is a checkbox', () => {
    expect(template).toMatch(/<input type="checkbox" name="system\.isSpecialized" \{\{checked system\.isSpecialized\}\}/);
  });

  test('its labels exist in lang/en.json', () => {
    const lang = JSON.parse(fs.readFileSync('lang/en.json', 'utf8')).E20;
    for (const key of ['SpecializationSkill', 'SpecializationShift', 'SpecializationIsSpecialized']) {
      expect(template).toContain(`E20.${key}`);
      expect(lang[key]).toEqual(expect.any(String));
    }
  });

  test('the template keeps CRLF line endings', () => {
    expect(template).not.toMatch(/(?<!\r)\n/);
  });
});
