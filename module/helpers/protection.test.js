import { jest } from '@jest/globals';
import { getProtectionBoostBonus, isProtectionBoostActive, toggleProtectionBoost } from './protection.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { protectionBoostActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isProtectionBoostActive", () => {
  test("false by default", () => {
    expect(isProtectionBoostActive(makeActor())).toBe(false);
  });

  test("true once the flag is set", () => {
    expect(isProtectionBoostActive(makeActor({ active: true }))).toBe(true);
  });
});

describe("toggleProtectionBoost", () => {
  test("switches on from off", async () => {
    const actor = makeActor({ active: false });
    expect(await toggleProtectionBoost(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectionBoostActive', true);
  });

  test("switches off from on, free", async () => {
    const actor = makeActor({ active: true });
    expect(await toggleProtectionBoost(actor)).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectionBoostActive', false);
  });
});

describe("getProtectionBoostBonus", () => {
  test("+1 while active", () => {
    expect(getProtectionBoostBonus(makeActor({ active: true }))).toBe(1);
  });

  test("0 while inactive", () => {
    expect(getProtectionBoostBonus(makeActor({ active: false }))).toBe(0);
  });
});
