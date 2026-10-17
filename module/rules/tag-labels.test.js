import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAG_FAMILIES } from './editor-spec.mjs';
import { fieldLabel } from './editor-render.mjs';

const LANG = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lang', 'en.json'), 'utf8'));
const FIELD = LANG.E20.Rules.Field;

describe('condition editor labels', () => {
  test('every family the "when" editor offers has a label and a hint, starting lower case', () => {
    for (const [family] of [['level'], ...TAG_FAMILIES]) {
      expect([family, typeof FIELD.Tag[family]]).toEqual([family, 'string']);
      expect([family, typeof FIELD.TagHint[family]]).toEqual([family, 'string']);
      // The labels read as the middle of a sentence: lower case, with game terms (Skill, Essence...) capitalised.
      expect([family, /^[a-z]/.test(FIELD.Tag[family])]).toEqual([family, true]);
    }
  });

  test('an unlabelled family falls back to lower-case words; other fields keep their capitals', () => {
    expect(fieldLabel('Tag.someNewFamily')).toBe('some new family');
    expect(fieldLabel('onSuccess')).toBe('on Success');
  });
});
