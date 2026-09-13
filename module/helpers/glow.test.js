import { jest } from '@jest/globals';
import { applyGlow, isGlowActive, removeGlow } from './glow.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { glowActive: active };
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

describe("isGlowActive / applyGlow / removeGlow", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isGlowActive(actor)).toBe(false);

    await applyGlow(actor);
    expect(isGlowActive(actor)).toBe(true);

    await removeGlow(actor);
    expect(isGlowActive(actor)).toBe(false);
  });
});
