import { jest } from '@jest/globals';
import { applyLightningSpeed, isLightningSpeedActive } from './lightning-speed.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { lightningSpeedActive: active };
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isLightningSpeedActive / applyLightningSpeed", () => {
  test("false by default, true once applied", async () => {
    const actor = makeActor();
    expect(isLightningSpeedActive(actor)).toBe(false);
    await applyLightningSpeed(actor);
    expect(isLightningSpeedActive(actor)).toBe(true);
  });
});
