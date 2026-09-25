import { jest } from '@jest/globals';
import { applyFoolscarrot, isFoolscarrotActive, removeFoolscarrot } from './foolscarrot.mjs';

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

describe("isFoolscarrotActive / applyFoolscarrot / removeFoolscarrot", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isFoolscarrotActive(actor)).toBe(false);

    await applyFoolscarrot(actor);
    expect(isFoolscarrotActive(actor)).toBe(true);

    await removeFoolscarrot(actor);
    expect(isFoolscarrotActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyFoolscarrot(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isFoolscarrotActive(actor)).toBe(false);
  });
});
