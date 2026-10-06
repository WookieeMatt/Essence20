import { jest } from '@jest/globals';
import {
  isCalmingWordsBuffActive,
} from './calming-words.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) } };

function makeTargetActor({ buffActive = false } = {}) {
  const flagStore = { calmingWordsBuffActive: buffActive };
  return {
    system: { resistances: {} },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isCalmingWordsBuffActive", () => {
  test("false by default", () => {
    expect(isCalmingWordsBuffActive(makeTargetActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isCalmingWordsBuffActive(makeTargetActor({ buffActive: true }))).toBe(true);
  });
});
