import { jest } from '@jest/globals';
import { isBlazingStrikesActive, activateBlazingStrikes } from './blazing-strikes.mjs';

function makeActor(active = false) {
  const flagStore = { blazingStrikesActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => { flagStore[key] = value; }),
  };
}

describe("isBlazingStrikesActive", () => {
  test("false by default", () => {
    expect(isBlazingStrikesActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isBlazingStrikesActive(makeActor(true))).toBe(true);
  });
});

describe("activateBlazingStrikes", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateBlazingStrikes(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'blazingStrikesActive', true);
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateBlazingStrikes(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
