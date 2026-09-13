import { jest } from '@jest/globals';
import { applyOokieSpookies, isOokieSpookiesActive, removeOokieSpookies } from './ookie-spookies.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { ookieSpookiesActive: active };
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

describe("isOokieSpookiesActive / applyOokieSpookies / removeOokieSpookies", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isOokieSpookiesActive(actor)).toBe(false);

    await applyOokieSpookies(actor);
    expect(isOokieSpookiesActive(actor)).toBe(true);

    await removeOokieSpookies(actor);
    expect(isOokieSpookiesActive(actor)).toBe(false);
  });
});
