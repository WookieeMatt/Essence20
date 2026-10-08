import { jest } from '@jest/globals';
import { activateForWindow } from '../../mechanics/resources/scene-clock.mjs';
import { isBlockMagicActive, removeBlockMagic } from './block-magic.mjs';

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

describe("isBlockMagicActive / applyBlockMagic / removeBlockMagic", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isBlockMagicActive(actor)).toBe(false);

    await activateForWindow(actor, 'blockMagicActive', 'scene');
    expect(isBlockMagicActive(actor)).toBe(true);

    await removeBlockMagic(actor);
    expect(isBlockMagicActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await activateForWindow(actor, 'blockMagicActive', 'scene');

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isBlockMagicActive(actor)).toBe(false);
  });
});
