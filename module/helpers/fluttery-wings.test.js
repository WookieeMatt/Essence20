import { jest } from '@jest/globals';
import { applyFlutteryWings, getFlutteryWingsBonus, isFlutteryWingsActive } from './fluttery-wings.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { flutteryWingsActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isFlutteryWingsActive / applyFlutteryWings", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isFlutteryWingsActive(actor)).toBe(false);
    await applyFlutteryWings(actor);
    expect(isFlutteryWingsActive(actor)).toBe(true);
  });
});

describe("getFlutteryWingsBonus", () => {
  test("+15 while active", () => {
    expect(getFlutteryWingsBonus(makeActor({ active: true }))).toBe(15);
  });

  test("0 while inactive", () => {
    expect(getFlutteryWingsBonus(makeActor({ active: false }))).toBe(0);
  });
});
