import { jest } from '@jest/globals';
import { applyGreasedLightning, isGreasedLightningActive, removeGreasedLightning } from './greased-lightning.mjs';

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

describe("isGreasedLightningActive / applyGreasedLightning / removeGreasedLightning", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isGreasedLightningActive(actor)).toBe(false);

    await applyGreasedLightning(actor);
    expect(isGreasedLightningActive(actor)).toBe(true);

    await removeGreasedLightning(actor);
    expect(isGreasedLightningActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyGreasedLightning(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isGreasedLightningActive(actor)).toBe(false);
  });
});
