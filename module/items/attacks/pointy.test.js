import { jest } from '@jest/globals';
import { isPointyActive, togglePointy } from './pointy.mjs';

function makeActor(active = false) {
  const flagStore = { pointyActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isPointyActive", () => {
  test("false by default", () => {
    expect(isPointyActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isPointyActive(makeActor(true))).toBe(true);
  });
});

describe("togglePointy", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await togglePointy(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pointyActive', true);
    expect(isPointyActive(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await togglePointy(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pointyActive', false);
    expect(isPointyActive(actor)).toBe(false);
  });
});
