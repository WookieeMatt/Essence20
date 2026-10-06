import { jest } from '@jest/globals';
import { isCannoneerDugIn, toggleCannoneerDigIn } from './cannoneer-dig-in.mjs';

function makeActor(dugIn = false) {
  const flagStore = { cannoneerDugIn: dugIn };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isCannoneerDugIn", () => {
  test("false by default", () => {
    expect(isCannoneerDugIn(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isCannoneerDugIn(makeActor(true))).toBe(true);
  });
});

describe("toggleCannoneerDigIn", () => {
  test("turns it on from off, and returns true", async () => {
    const actor = makeActor(false);
    const result = await toggleCannoneerDigIn(actor);
    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'cannoneerDugIn', true);
    expect(isCannoneerDugIn(actor)).toBe(true);
  });

  test("turns it off from on, and returns false", async () => {
    const actor = makeActor(true);
    const result = await toggleCannoneerDigIn(actor);
    expect(result).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'cannoneerDugIn', false);
    expect(isCannoneerDugIn(actor)).toBe(false);
  });
});
