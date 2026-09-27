import { jest } from '@jest/globals';
import { applyOokieSpookies, isOokieSpookiesActive, removeOokieSpookies } from './ookie-spookies.mjs';

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

describe("isOokieSpookiesActive / applyOokieSpookies / removeOokieSpookies", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isOokieSpookiesActive(actor)).toBe(false);

    await applyOokieSpookies(actor);
    expect(isOokieSpookiesActive(actor)).toBe(true);

    await removeOokieSpookies(actor);
    expect(isOokieSpookiesActive(actor)).toBe(false);
  });

  test("clears once the scene ends", async () => {
    const actor = makeActor();
    await applyOokieSpookies(actor);

    global.game.settings.get = jest.fn((scope, key) => (key === 'sceneClockScene' ? 2 : undefined));

    expect(isOokieSpookiesActive(actor)).toBe(false);
  });
});
