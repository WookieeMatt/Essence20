import { jest } from '@jest/globals';
import { applyHotToTrot, isHotToTrotActive, removeHotToTrot } from './hot-to-trot.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { hotToTrotActive: active };
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

describe("isHotToTrotActive / applyHotToTrot / removeHotToTrot", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isHotToTrotActive(actor)).toBe(false);

    await applyHotToTrot(actor);
    expect(isHotToTrotActive(actor)).toBe(true);

    await removeHotToTrot(actor);
    expect(isHotToTrotActive(actor)).toBe(false);
  });
});
