import { jest } from '@jest/globals';
import { applyLightningSpeed, isLightningSpeedActive } from './lightning-speed.mjs';

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

describe("isLightningSpeedActive / applyLightningSpeed", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isLightningSpeedActive(actor)).toBe(false);
    await applyLightningSpeed(actor);
    expect(isLightningSpeedActive(actor)).toBe(true);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyLightningSpeed(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isLightningSpeedActive(actor)).toBe(false);
  });
});
