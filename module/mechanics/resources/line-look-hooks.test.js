/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

const applyThemeClass = jest.fn();
jest.unstable_mockModule('./settings.js', () => ({ applyThemeClass }));
jest.unstable_mockModule('./mechanics/resources/line-terms-hooks.mjs', () => ({ termsLineOf: actor => actor.line ?? '' }));
const { stampLine } = await import('./line-look-hooks.mjs');

beforeEach(() => applyThemeClass.mockClear());

test("a sheet is stamped with its character's line, then re-themed", () => {
  const sheet = document.createElement('div');
  stampLine(sheet, { line: 'thundercats' });
  expect(sheet.dataset.e20Line).toBe('thundercats');
  expect(applyThemeClass).toHaveBeenCalledWith(sheet);
});

test('no character (an unowned item, a message with no speaker): the stamp comes off and the world look applies', () => {
  const sheet = document.createElement('div');
  sheet.dataset.e20Line = 'thundercats';
  stampLine(sheet, null);
  expect(sheet.dataset.e20Line).toBeUndefined();
  expect(applyThemeClass).toHaveBeenCalledWith(sheet);
  stampLine(undefined, { line: 'x' });
  expect(applyThemeClass).toHaveBeenCalledTimes(1);
});
