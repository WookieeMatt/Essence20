import { jest } from '@jest/globals';
import { applyDsoeDisguise, isDsoeDisguiseActive } from './dsoe-disguise.mjs';

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("isDsoeDisguiseActive / applyDsoeDisguise", () => {
  test("false by default, true once activated", async () => {
    const actor = makeActor();
    expect(isDsoeDisguiseActive(actor)).toBe(false);
    await applyDsoeDisguise(actor);
    expect(isDsoeDisguiseActive(actor)).toBe(true);
  });
});
