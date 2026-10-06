import { jest } from '@jest/globals';
import { isBulwarkActive, toggleBulwark } from './bulwark.mjs';

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

describe("toggleBulwark", () => {
  test("plants from unplanted, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleBulwark(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bulwarkActive', true);
    expect(isBulwarkActive(actor)).toBe(true);
  });

  test("unplants from planted, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleBulwark(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bulwarkActive', false);
    expect(isBulwarkActive(actor)).toBe(false);
  });
});
