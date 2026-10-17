import { jest } from '@jest/globals';
import { setShape, shapeOf } from './pony-shape-shifting.mjs';

const actor = (extra = {}) => {
  const a = { uuid: 'Actor.a', name: 'A', system: extra.system ?? {}, flags: { essence20: extra.flags ?? {} }, items: { contents: [] }, getActiveTokens: () => [] };
  a.setFlag = jest.fn(async (scope, key, value) => (a.flags[scope][key] = value));
  return a;
};

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, user: { targets: new Set() }, actors: [], settings: { get: () => 1 } };
  global.CONFIG = { E20: { skills: {} } };
});

// Face-Shift / Master Morph's Skills and the Change Shape dialog are item rules (rules/conv15-items1.test.js).
test('a shape lasts the scene it was taken in', async () => {
  const holder = actor();
  expect(shapeOf(holder)).toBeNull();
  await setShape(holder, { faceSkill: 'persuasion' });
  expect(shapeOf(holder)).toEqual({ faceSkill: 'persuasion', scene: 1 });
  global.game.settings = { get: () => 2 };
  expect(shapeOf(holder)).toBeNull();
});

