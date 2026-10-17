import { jest } from '@jest/globals';
import { isBulwarkActive } from './bulwark.mjs';

function makeActor(planted = false) {
  const flagStore = { bulwarkActive: planted };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isBulwarkActive", () => {
  test("false by default", () => {
    expect(isBulwarkActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isBulwarkActive(makeActor(true))).toBe(true);
  });
});
