import { jest } from '@jest/globals';
import { applyFlutteryWings, getFlutteryWingsBonus, isFlutteryWingsActive } from './fluttery-wings.mjs';

function makeActor(flags = {}) {
  const flagStore = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

beforeEach(() => {
  global.game = {
    user: { isGM: true },
    settings: { get: jest.fn(() => undefined), set: jest.fn() },
  };
});

describe("isFlutteryWingsActive / applyFlutteryWings", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isFlutteryWingsActive(actor)).toBe(false);
    await applyFlutteryWings(actor);
    expect(isFlutteryWingsActive(actor)).toBe(true);
  });

  // The whole point of routing this through the Scene Clock instead of a plain boolean flag: "1
  // day" used to mean "forever, until someone manually clears it."
  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyFlutteryWings(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isFlutteryWingsActive(actor)).toBe(false);
  });
});

describe("getFlutteryWingsBonus", () => {
  test("+15 while active", async () => {
    const actor = makeActor();
    await applyFlutteryWings(actor);
    expect(getFlutteryWingsBonus(actor)).toBe(15);
  });

  test("0 while inactive", () => {
    expect(getFlutteryWingsBonus(makeActor())).toBe(0);
  });
});
