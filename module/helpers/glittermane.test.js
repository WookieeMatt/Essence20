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
