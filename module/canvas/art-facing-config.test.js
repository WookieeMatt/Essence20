import { jest } from '@jest/globals';
import { addArtFacingField, artFacingField } from './art-facing-config.mjs';

/** Art Faces on the Token configuration (art-facing-config.mjs). */

test('the select lists Auto and the four directions, with the token\'s own selected', () => {
  const html = artFacingField({ flags: { essence20: { artFacing: 'left' } } });
  expect(html).toContain('name="flags.essence20.artFacing"');
  expect([...html.matchAll(/<option value="(\w+)"/g)].map(match => match[1])).toEqual(['auto', 'down', 'right', 'up', 'left']);
  expect(html).toMatch(/<option value="left" selected>/);
  expect(artFacingField({})).toMatch(/<option value="auto" selected>/);
});

test('added under Lock Rotation once; nothing without that field or a document', () => {
  const lock = { insertAdjacentHTML: jest.fn() };
  let added = null;
  const root = { querySelector: selector => (selector == '[name="lockRotation"]' ? { closest: () => lock } : added) };
  expect(addArtFacingField({ document: { flags: {} } }, root)).toBe(true);
  expect(lock.insertAdjacentHTML).toHaveBeenCalledWith('afterend', expect.stringContaining('e20-art-facing'));
  added = {};
  expect(addArtFacingField({ document: { flags: {} } }, root)).toBe(false);
  expect(addArtFacingField({}, root)).toBe(false);
});
