import { jest } from '@jest/globals';
import { getReactiveBoostBonus, isReactiveBoostActive, toggleReactiveBoost } from './reactive.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { reactiveBoostActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isReactiveBoostActive", () => {
  test("false by default", () => {
    expect(isReactiveBoostActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isReactiveBoostActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleReactiveBoost", () => {
  test("switches on from off", async () => {
    const actor = makeActor({ active: false });
    expect(await toggleReactiveBoost(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'reactiveBoostActive', true);
  });

  test("switches off from on, free", async () => {
    const actor = makeActor({ active: true });
    expect(await toggleReactiveBoost(actor)).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'reactiveBoostActive', false);
  });
});

describe("getReactiveBoostBonus", () => {
  test("+1 while active", () => {
    expect(getReactiveBoostBonus(makeActor({ active: true }))).toBe(1);
  });

  test("0 while inactive", () => {
    expect(getReactiveBoostBonus(makeActor({ active: false }))).toBe(0);
  });
});
