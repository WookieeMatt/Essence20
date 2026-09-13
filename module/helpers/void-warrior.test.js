import { jest } from '@jest/globals';
import { isVoidWarriorActive, activateVoidWarrior } from './void-warrior.mjs';

function makeActor(active = false) {
  const flagStore = { voidWarriorActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
  };
}

describe("isVoidWarriorActive", () => {
  test("false by default", () => {
    expect(isVoidWarriorActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isVoidWarriorActive(makeActor(true))).toBe(true);
  });
});

describe("activateVoidWarrior", () => {
  test("sets the flag and returns true", async () => {
    const actor = makeActor(false);

    const result = await activateVoidWarrior(actor);

    expect(result).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'voidWarriorActive', true);
  });

  test("no-ops and returns false when already active", async () => {
    const actor = makeActor(true);

    const result = await activateVoidWarrior(actor);

    expect(result).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
