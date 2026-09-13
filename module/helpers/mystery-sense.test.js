import { jest } from '@jest/globals';
import { applyMysterySense, isMysterySenseActive, removeMysterySense } from './mystery-sense.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { mysterySenseActive: active };
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

describe("isMysterySenseActive / applyMysterySense / removeMysterySense", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isMysterySenseActive(actor)).toBe(false);

    await applyMysterySense(actor);
    expect(isMysterySenseActive(actor)).toBe(true);

    await removeMysterySense(actor);
    expect(isMysterySenseActive(actor)).toBe(false);
  });
});
