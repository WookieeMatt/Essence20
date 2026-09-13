import { jest } from '@jest/globals';
import { isSkiing, toggleSkiing } from './skier.mjs';

function makeActor(skiing = false) {
  const flagStore = { isSkiingActive: skiing };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isSkiing", () => {
  test("false by default", () => {
    expect(isSkiing(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isSkiing(makeActor(true))).toBe(true);
  });
});

describe("toggleSkiing", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleSkiing(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'isSkiingActive', true);
    expect(isSkiing(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleSkiing(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'isSkiingActive', false);
    expect(isSkiing(actor)).toBe(false);
  });
});
