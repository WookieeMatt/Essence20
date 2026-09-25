import { jest } from '@jest/globals';
import { applyDsoeDisguise, isDsoeDisguiseActive } from './dsoe-disguise.mjs';

function makeActor() {
  const flagStore = {};
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

describe("isDsoeDisguiseActive / applyDsoeDisguise", () => {
  test("false by default, true once activated", async () => {
    const actor = makeActor();
    expect(isDsoeDisguiseActive(actor)).toBe(false);
    await applyDsoeDisguise(actor);
    expect(isDsoeDisguiseActive(actor)).toBe(true);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyDsoeDisguise(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isDsoeDisguiseActive(actor)).toBe(false);
  });
});
