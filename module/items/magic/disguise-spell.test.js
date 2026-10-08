import { jest } from '@jest/globals';
import { activateForWindow } from '../../mechanics/resources/scene-clock.mjs';
import { isDsoeDisguiseActive } from './disguise-spell.mjs';

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
    await activateForWindow(actor, 'dsoeDisguiseActive', 'scene');
    expect(isDsoeDisguiseActive(actor)).toBe(true);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'dsoeDisguiseActive', 'scene');

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isDsoeDisguiseActive(actor)).toBe(false);
  });
});
