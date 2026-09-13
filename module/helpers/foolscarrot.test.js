import { jest } from '@jest/globals';
import { applyFoolscarrot, isFoolscarrotActive, removeFoolscarrot } from './foolscarrot.mjs';

function makeActor({ active = false } = {}) {
  const flagStore = { foolscarrotActive: active };
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

describe("isFoolscarrotActive / applyFoolscarrot / removeFoolscarrot", () => {
  test("false by default, true once applied, false once removed", async () => {
    const actor = makeActor();
    expect(isFoolscarrotActive(actor)).toBe(false);

    await applyFoolscarrot(actor);
    expect(isFoolscarrotActive(actor)).toBe(true);

    await removeFoolscarrot(actor);
    expect(isFoolscarrotActive(actor)).toBe(false);
  });
});
