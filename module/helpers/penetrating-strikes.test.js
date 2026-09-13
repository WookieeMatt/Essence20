import { jest } from '@jest/globals';
import { isPenetratingStrikesActive, activatePenetratingStrikes } from './penetrating-strikes.mjs';

function makeActor(active = false) {
  const flagStore = { penetratingStrikesActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
  };
}

describe("isPenetratingStrikesActive", () => {
  test("false by default", () => {
    expect(isPenetratingStrikesActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isPenetratingStrikesActive(makeActor(true))).toBe(true);
  });
});

describe("activatePenetratingStrikes", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activatePenetratingStrikes(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'penetratingStrikesActive', true);
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activatePenetratingStrikes(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
