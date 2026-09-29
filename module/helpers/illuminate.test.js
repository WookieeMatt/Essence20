import { jest } from '@jest/globals';

const ACTIVE = { epoch: 1, window: 'encounter', count: 1 };
import { isIlluminateActive, activateIlluminate } from './illuminate.mjs';

function makeActor(active = false) {
  // An active record is a Scene Clock duration stamped with the current (default 1) encounter.
  const flagStore = { illuminateActive: active === true ? ACTIVE : active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isIlluminateActive", () => {
  test("false by default", () => {
    expect(isIlluminateActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isIlluminateActive(makeActor(true))).toBe(true);
  });

  test("false once its encounter has passed", () => {
    expect(isIlluminateActive(makeActor({ ...ACTIVE, epoch: 0 }))).toBe(false);
  });

  test("a leftover plain-true flag from before durations reads as expired", () => {
    expect(isIlluminateActive(makeActor('legacy'))).toBe(false);
  });
});

describe("activateIlluminate", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateIlluminate(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'illuminateActive', expect.objectContaining({ epoch: 1, count: 1 }));
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateIlluminate(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
