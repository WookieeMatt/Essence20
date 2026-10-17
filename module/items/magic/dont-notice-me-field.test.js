import { jest } from '@jest/globals';
import { activateForWindow } from '../../mechanics/resources/scene-clock.mjs';
import { isDontNoticeMeFieldActive } from './dont-notice-me-field.mjs';

function makeActor(flags = {}) {
  const flagStore = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    toggleStatusEffect: jest.fn(),
  };
}

beforeEach(() => {
  global.game = {
    user: { isGM: true },
    settings: { get: jest.fn(() => undefined), set: jest.fn() },
  };
});

describe("isDontNoticeMeFieldActive (the spell rule sets the scene flag)", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isDontNoticeMeFieldActive(actor)).toBe(false);
    await activateForWindow(actor, 'dontNoticeMeFieldActive', 'scene');
    expect(isDontNoticeMeFieldActive(actor)).toBe(true);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'dontNoticeMeFieldActive', 'scene');

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isDontNoticeMeFieldActive(actor)).toBe(false);
  });
});
