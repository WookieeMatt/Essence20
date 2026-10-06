import { jest } from '@jest/globals';

const ACTIVE = { epoch: 1, window: 'encounter', count: 1 };
import { isPenetratingStrikesActive, activatePenetratingStrikes } from './penetrating-strikes.mjs';

function makeActor(active = false) {
  // An active record is a Scene Clock duration stamped with the current (default 1) encounter.
  const flagStore = { penetratingStrikesActive: active === true ? ACTIVE : active };
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

  test("false once its encounter has passed", () => {
    expect(isPenetratingStrikesActive(makeActor({ ...ACTIVE, epoch: 0 }))).toBe(false);
  });

  test("a leftover plain-true flag from before durations reads as expired", () => {
    expect(isPenetratingStrikesActive(makeActor('legacy'))).toBe(false);
  });
});

describe("activatePenetratingStrikes", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activatePenetratingStrikes(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'penetratingStrikesActive', expect.objectContaining({ epoch: 1, count: 1 }));
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activatePenetratingStrikes(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
