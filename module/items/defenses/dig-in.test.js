import { jest } from '@jest/globals';
import { isDugIn, toggleDigIn } from './dig-in.mjs';

function makeActor(dugIn = false) {
  const flagStore = { digInActive: dugIn };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isDugIn", () => {
  test("false by default", () => {
    expect(isDugIn(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isDugIn(makeActor(true))).toBe(true);
  });
});

describe("toggleDigIn", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleDigIn(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digInActive', true);
    expect(isDugIn(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleDigIn(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digInActive', false);
    expect(isDugIn(actor)).toBe(false);
  });
});
