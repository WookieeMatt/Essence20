import { jest } from '@jest/globals';
import { applyGlittermane, isGlittermaneActive, removeGlittermane } from './glittermane.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { glittermaneActive: active };
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

describe("isGlittermaneActive / applyGlittermane / removeGlittermane", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isGlittermaneActive(actor)).toBe(false);

    await applyGlittermane(actor);
    expect(isGlittermaneActive(actor)).toBe(true);

    await removeGlittermane(actor);
    expect(isGlittermaneActive(actor)).toBe(false);
  });
});

describe("Glittermane's 1-scene duration", () => {
  afterEach(() => {
    delete global.game;
  });

  test("expires when the GM starts a new scene", async () => {
    const settings = { sceneClockScene: 1 };
    global.game = { settings: { get: (scope, key) => settings[key] } };
    const actor = makeActor();
    await applyGlittermane(actor);
    expect(isGlittermaneActive(actor)).toBe(true);

    settings.sceneClockScene = 2;
    expect(isGlittermaneActive(actor)).toBe(false);
  });

  test("a leftover plain-true flag from before it had a duration reads as expired", () => {
    expect(isGlittermaneActive(makeActor({ active: true }))).toBe(false);
  });
});
