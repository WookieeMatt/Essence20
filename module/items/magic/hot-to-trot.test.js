import { jest } from '@jest/globals';
import { activateForWindow } from '../../mechanics/resources/scene-clock.mjs';
import { isHotToTrotActive, removeHotToTrot } from './hot-to-trot.mjs';

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

describe("isHotToTrotActive / applyHotToTrot / removeHotToTrot", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isHotToTrotActive(actor)).toBe(false);

    await activateForWindow(actor, 'hotToTrotActive', 'scene');
    expect(isHotToTrotActive(actor)).toBe(true);

    await removeHotToTrot(actor);
    expect(isHotToTrotActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'hotToTrotActive', 'scene');

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isHotToTrotActive(actor)).toBe(false);
  });
});
