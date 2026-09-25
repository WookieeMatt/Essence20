import { jest } from '@jest/globals';
import { isIlluminateActive, activateIlluminate } from './illuminate.mjs';

function makeActor(active = false) {
  const flagStore = { illuminateActive: active };
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
});

describe("activateIlluminate", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateIlluminate(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'illuminateActive', true);
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateIlluminate(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
