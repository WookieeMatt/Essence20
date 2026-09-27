import { jest } from '@jest/globals';
import { isInfiltrating, toggleInfiltrating } from './infiltrating.mjs';

function makeActor(active = false) {
  const flags = { infiltratingActive: active };
  return {
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("isInfiltrating", () => {
  test("false by default, true once set", () => {
    expect(isInfiltrating(makeActor(false))).toBe(false);
    expect(isInfiltrating(makeActor(true))).toBe(true);
  });
});

describe("toggleInfiltrating", () => {
  test("flips false to true and back", async () => {
    const actor = makeActor(false);

    expect(await toggleInfiltrating(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'infiltratingActive', true);

    expect(await toggleInfiltrating(actor)).toBe(false);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'infiltratingActive', false);
  });
});
