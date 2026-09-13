import { jest } from '@jest/globals';
import { applyGreasedLightning, isGreasedLightningActive, removeGreasedLightning } from './greased-lightning.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { greasedLightningActive: active };
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

describe("isGreasedLightningActive / applyGreasedLightning / removeGreasedLightning", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isGreasedLightningActive(actor)).toBe(false);

    await applyGreasedLightning(actor);
    expect(isGreasedLightningActive(actor)).toBe(true);

    await removeGreasedLightning(actor);
    expect(isGreasedLightningActive(actor)).toBe(false);
  });
});
