import { jest } from '@jest/globals';
import { applyMysterySense, isMysterySenseActive, removeMysterySense } from './mystery-sense.mjs';

function makeActor(flags = {}) {
  const flagStore = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flagStore[key];
    }),
  };
}

beforeEach(() => {
  global.game = {
    user: { isGM: true },
    settings: { get: jest.fn(() => undefined), set: jest.fn() },
  };
});

describe("isMysterySenseActive / applyMysterySense / removeMysterySense", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isMysterySenseActive(actor)).toBe(false);

    await applyMysterySense(actor);
    expect(isMysterySenseActive(actor)).toBe(true);

    await removeMysterySense(actor);
    expect(isMysterySenseActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyMysterySense(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isMysterySenseActive(actor)).toBe(false);
  });
});
